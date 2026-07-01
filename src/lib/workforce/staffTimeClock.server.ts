import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  calendarDateStringFromInstant,
  resolveTenantCalendarTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { insertFiStaffPinAuditEvent } from "@/src/lib/staffPin/staffPinAudit.server";
import { createTimesheetEntry } from "@/src/lib/workforce/wageProfile.server";
import { resolveStaffMemberContext } from "@/src/lib/workforce/workforceStaffMemberResolve.server";

import {
  deriveGrossMinutesWorked,
  deriveNetMinutesWorked,
  sumBreakMinutes,
  type ClockInResult,
  type ClockOutResult,
  type PinBreakSessionState,
  type TimePunchBreak,
  type WorkforceTimePunch,
} from "./staffTimeClockCore";

type PunchRow = Record<string, unknown>;
type BreakRow = Record<string, unknown>;

function mapBreak(row: BreakRow): TimePunchBreak {
  const status = String(row.status) as TimePunchBreak["status"];
  const breakStartAt = String(row.break_start_at);
  const breakEndAt = row.break_end_at != null ? String(row.break_end_at) : null;
  return {
    id: String(row.id),
    punchId: String(row.punch_id),
    breakStartAt,
    breakEndAt,
    status,
    source: String(row.source) as TimePunchBreak["source"],
    minutes:
      status === "closed" && breakEndAt
        ? sumBreakMinutes([{ breakStartAt, breakEndAt, status }])
        : null,
    notes: row.notes != null ? String(row.notes) : null,
  };
}

function mapTimePunch(
  row: PunchRow,
  breaks: TimePunchBreak[],
  staffName?: string | null
): WorkforceTimePunch {
  const status = String(row.status) as WorkforceTimePunch["status"];
  const clockInAt = String(row.clock_in_at);
  const clockOutAt = row.clock_out_at != null ? String(row.clock_out_at) : null;
  const closedBreaks = breaks.filter((b) => b.status === "closed");
  const breakMinutes = sumBreakMinutes(closedBreaks);
  const hasOpenBreak = breaks.some((b) => b.status === "open");
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    staffMemberId: row.staff_member_id != null ? String(row.staff_member_id) : null,
    fiStaffId: String(row.fi_staff_id),
    staffFullName: staffName ?? null,
    workDate: String(row.work_date).slice(0, 10),
    clockInAt,
    clockOutAt,
    pinSessionId: row.pin_session_id != null ? String(row.pin_session_id) : null,
    shiftId: row.shift_id != null ? String(row.shift_id) : null,
    timesheetEntryId:
      row.timesheet_entry_id != null ? String(row.timesheet_entry_id) : null,
    status,
    source: String(row.source) as WorkforceTimePunch["source"],
    grossMinutesWorked: deriveGrossMinutesWorked(status, clockInAt, clockOutAt),
    breakMinutes,
    minutesWorked: deriveNetMinutesWorked(status, clockInAt, clockOutAt, breakMinutes),
    breaks,
    hasOpenBreak,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function loadTenantTimezone(
  tenantId: string,
  client: SupabaseClient
): Promise<string> {
  const { data, error } = await client
    .from("fi_tenant_settings")
    .select("default_timezone, metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as {
    default_timezone?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  return resolveTenantCalendarTimezone(row);
}

async function loadStaffNameByFiStaffId(
  tenantId: string,
  fiStaffId: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data, error } = await client
    .from("fi_staff")
    .select("full_name")
    .eq("tenant_id", tenantId)
    .eq("id", fiStaffId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { full_name: string }).full_name) : null;
}

async function findOpenPunchRow(
  tenantId: string,
  fiStaffId: string,
  client: SupabaseClient
): Promise<PunchRow | null> {
  const { data, error } = await client
    .from("fi_workforce_time_punches")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("fi_staff_id", fiStaffId)
    .eq("status", "open")
    .maybeSingle();
  if (error) {
    if (error.message?.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  return data ? (data as PunchRow) : null;
}

async function loadBreaksForPunchIds(
  tenantId: string,
  punchIds: string[],
  client: SupabaseClient
): Promise<Map<string, TimePunchBreak[]>> {
  const map = new Map<string, TimePunchBreak[]>();
  if (punchIds.length === 0) return map;
  const { data, error } = await client
    .from("fi_workforce_time_punch_breaks")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("punch_id", punchIds)
    .neq("status", "void")
    .order("break_start_at", { ascending: true });
  if (error) {
    if (error.message?.includes("does not exist")) return map;
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as BreakRow[]) {
    const punchId = String(row.punch_id);
    const list = map.get(punchId) ?? [];
    list.push(mapBreak(row));
    map.set(punchId, list);
  }
  return map;
}

async function resolvePinSessionRowId(
  tenantId: string,
  sessionToken: string | null | undefined,
  client: SupabaseClient
): Promise<string | null> {
  const token = sessionToken?.trim();
  if (!token) return null;
  const { data, error } = await client
    .from("fi_staff_pin_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("session_token", token)
    .maybeSingle();
  if (error) return null;
  return data ? String((data as { id: string }).id) : null;
}

async function closeOpenBreaksForPunch(
  tenantId: string,
  punchId: string,
  breakEndAt: string,
  client: SupabaseClient
): Promise<void> {
  await client
    .from("fi_workforce_time_punch_breaks")
    .update({
      break_end_at: breakEndAt,
      status: "closed",
      updated_at: breakEndAt,
    })
    .eq("tenant_id", tenantId)
    .eq("punch_id", punchId)
    .eq("status", "open");
}

type ClosePunchOpts = {
  tenantId: string;
  punchRow: PunchRow;
  clockOutAt: string;
  source: WorkforceTimePunch["source"];
  notes?: string | null;
  managerFiUserId?: string | null;
  client?: SupabaseClient;
};

async function closeTimePunch(opts: ClosePunchOpts): Promise<ClockOutResult> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const supabase = opts.client ?? supabaseAdmin();
  const punchId = String(opts.punchRow.id);
  const fiStaffId = String(opts.punchRow.fi_staff_id);
  const clockOutAt = opts.clockOutAt;
  const staffName = await loadStaffNameByFiStaffId(tid, fiStaffId, supabase);

  await closeOpenBreaksForPunch(tid, punchId, clockOutAt, supabase);

  const breaksMap = await loadBreaksForPunchIds(tid, [punchId], supabase);
  const breaks = breaksMap.get(punchId) ?? [];
  const breakMinutes = sumBreakMinutes(breaks.filter((b) => b.status === "closed"));
  const grossMinutes = deriveGrossMinutesWorked(
    "closed",
    String(opts.punchRow.clock_in_at),
    clockOutAt
  );
  const netMinutes =
    grossMinutes != null ? Math.max(0, grossMinutes - breakMinutes) : null;

  let timesheetEntryId: string | null = null;
  let timesheetPendingReason: string | null = null;

  const staffMemberId =
    opts.punchRow.staff_member_id != null
      ? String(opts.punchRow.staff_member_id)
      : (await resolveStaffMemberContext(tid, fiStaffId, supabase))?.staffMemberId ?? null;

  if (staffMemberId && netMinutes != null && netMinutes > 0) {
    try {
      const entry = await createTimesheetEntry({
        tenantId: tid,
        staffMemberId,
        workDate: String(opts.punchRow.work_date).slice(0, 10),
        entryType: "regular",
        minutesWorked: netMinutes,
        shiftId:
          opts.punchRow.shift_id != null ? String(opts.punchRow.shift_id) : null,
        notes:
          breakMinutes > 0
            ? `Auto-generated from PIN clock-out (${breakMinutes} min breaks deducted).`
            : "Auto-generated from PIN clock-out.",
        client: supabase,
      });
      timesheetEntryId = entry.id;
    } catch (e) {
      timesheetPendingReason =
        e instanceof Error ? e.message : "Could not generate timesheet entry.";
    }
  } else if (!staffMemberId) {
    timesheetPendingReason = "Staff member not linked in WorkforceOS.";
  } else {
    timesheetPendingReason = "Zero or invalid worked minutes.";
  }

  const metadata: Record<string, unknown> = {
    gross_minutes: grossMinutes,
    break_minutes: breakMinutes,
    net_minutes: netMinutes,
  };
  if (timesheetPendingReason) metadata.timesheet_pending_reason = timesheetPendingReason;
  if (opts.managerFiUserId) metadata.manager_corrected_by = opts.managerFiUserId;

  const { data, error } = await supabase
    .from("fi_workforce_time_punches")
    .update({
      clock_out_at: clockOutAt,
      status: "closed",
      source: opts.source,
      timesheet_entry_id: timesheetEntryId,
      staff_member_id: staffMemberId,
      notes: opts.notes?.trim() || (opts.punchRow.notes != null ? String(opts.punchRow.notes) : null),
      metadata,
      updated_at: clockOutAt,
    })
    .eq("tenant_id", tid)
    .eq("id", punchId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const closedBreaks = (await loadBreaksForPunchIds(tid, [punchId], supabase)).get(punchId) ?? [];

  return {
    punch: mapTimePunch(data as PunchRow, closedBreaks, staffName),
    timesheetEntryId,
    timesheetPendingReason,
  };
}

export async function listWorkforceTimePunches(
  tenantId: string,
  options?: { limit?: number; workDate?: string | null; openOnly?: boolean },
  client?: SupabaseClient
): Promise<WorkforceTimePunch[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  let q = supabase
    .from("fi_workforce_time_punches")
    .select("*")
    .eq("tenant_id", tid)
    .neq("status", "void")
    .order("work_date", { ascending: false })
    .order("clock_in_at", { ascending: false });
  if (options?.workDate?.trim()) q = q.eq("work_date", options.workDate.trim());
  if (options?.openOnly) q = q.eq("status", "open");
  if (options?.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as PunchRow[];
  const breaksMap = await loadBreaksForPunchIds(
    tid,
    rows.map((r) => String(r.id)),
    supabase
  );
  const names = await Promise.all(
    rows.map((r) => loadStaffNameByFiStaffId(tid, String(r.fi_staff_id), supabase))
  );
  return rows.map((r, i) =>
    mapTimePunch(r, breaksMap.get(String(r.id)) ?? [], names[i])
  );
}

export async function loadPinBreakSessionState(
  tenantId: string,
  fiStaffId: string,
  client?: SupabaseClient
): Promise<PinBreakSessionState> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(fiStaffId, "fiStaffId");
  const supabase = client ?? supabaseAdmin();
  const openRow = await findOpenPunchRow(tid, sid, supabase);
  if (!openRow) {
    return { hasOpenPunch: false, onBreak: false, punchId: null };
  }
  const punchId = String(openRow.id);
  const { data, error } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .select("id")
    .eq("tenant_id", tid)
    .eq("punch_id", punchId)
    .eq("status", "open")
    .maybeSingle();
  if (error && !error.message?.includes("does not exist")) {
    throw new Error(error.message);
  }
  return {
    hasOpenPunch: true,
    onBreak: Boolean(data),
    punchId,
  };
}

export async function clockInFromPinLogin(opts: {
  tenantId: string;
  fiStaffId: string;
  pinSessionToken?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  client?: SupabaseClient;
}): Promise<ClockInResult | null> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(opts.fiStaffId, "fiStaffId");
  const supabase = opts.client ?? supabaseAdmin();

  const existing = await findOpenPunchRow(tid, fiStaffId, supabase);
  if (existing) {
    const name = await loadStaffNameByFiStaffId(tid, fiStaffId, supabase);
    const breaks =
      (await loadBreaksForPunchIds(tid, [String(existing.id)], supabase)).get(
        String(existing.id)
      ) ?? [];
    return { punch: mapTimePunch(existing, breaks, name), resumed: true };
  }

  const [memberCtx, timeZone, pinSessionId, staffName] = await Promise.all([
    resolveStaffMemberContext(tid, fiStaffId, supabase),
    loadTenantTimezone(tid, supabase),
    resolvePinSessionRowId(tid, opts.pinSessionToken, supabase),
    loadStaffNameByFiStaffId(tid, fiStaffId, supabase),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const workDate = calendarDateStringFromInstant(now, timeZone);

  const { data, error } = await supabase
    .from("fi_workforce_time_punches")
    .insert({
      tenant_id: tid,
      staff_member_id: memberCtx?.staffMemberId ?? null,
      fi_staff_id: fiStaffId,
      work_date: workDate,
      clock_in_at: nowIso,
      pin_session_id: pinSessionId,
      status: "open",
      source: "pin",
      client_ip: opts.clientIp ?? null,
      user_agent: opts.userAgent ?? null,
      metadata: {},
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error) {
    if (error.message?.includes("does not exist")) return null;
    throw new Error(error.message);
  }

  await insertFiStaffPinAuditEvent({
    tenantId: tid,
    eventKind: "staff_pin.clock_in",
    staffId: fiStaffId,
    detail: { work_date: workDate, clock_in_at: nowIso },
  });

  return { punch: mapTimePunch(data as PunchRow, [], staffName), resumed: false };
}

export async function clockOutFromPinLogout(opts: {
  tenantId: string;
  fiStaffId: string;
  client?: SupabaseClient;
}): Promise<ClockOutResult | null> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(opts.fiStaffId, "fiStaffId");
  const supabase = opts.client ?? supabaseAdmin();

  const openRow = await findOpenPunchRow(tid, fiStaffId, supabase);
  if (!openRow) return null;

  const nowIso = new Date().toISOString();
  const result = await closeTimePunch({
    tenantId: tid,
    punchRow: openRow,
    clockOutAt: nowIso,
    source: "pin",
    client: supabase,
  });

  await insertFiStaffPinAuditEvent({
    tenantId: tid,
    eventKind: "staff_pin.clock_out",
    staffId: fiStaffId,
    detail: {
      work_date: result.punch.workDate,
      clock_out_at: nowIso,
      gross_minutes: result.punch.grossMinutesWorked,
      break_minutes: result.punch.breakMinutes,
      minutes_worked: result.punch.minutesWorked,
      timesheet_entry_id: result.timesheetEntryId,
      timesheet_pending_reason: result.timesheetPendingReason,
    },
  });

  return result;
}

export async function managerCloseForgottenPunch(opts: {
  tenantId: string;
  punchId: string;
  clockOutAt: string;
  notes: string;
  managerFiUserId: string;
  client?: SupabaseClient;
}): Promise<ClockOutResult> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const punchId = assertNonEmptyUuid(opts.punchId, "punchId");
  const supabase = opts.client ?? supabaseAdmin();
  const clockOutAt = opts.clockOutAt.trim();
  const notes = opts.notes.trim();
  if (!clockOutAt) throw new Error("clockOutAt is required.");
  if (!notes) throw new Error("A correction note is required.");

  const { data, error } = await supabase
    .from("fi_workforce_time_punches")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", punchId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Open punch not found.");

  const row = data as PunchRow;
  if (new Date(clockOutAt).getTime() <= new Date(String(row.clock_in_at)).getTime()) {
    throw new Error("Clock-out must be after clock-in.");
  }

  const result = await closeTimePunch({
    tenantId: tid,
    punchRow: row,
    clockOutAt,
    source: "manager_correction",
    notes,
    managerFiUserId: opts.managerFiUserId,
    client: supabase,
  });

  await insertFiStaffPinAuditEvent({
    tenantId: tid,
    eventKind: "staff_pin.clock_out",
    staffId: String(row.fi_staff_id),
    actorFiUserId: opts.managerFiUserId,
    detail: {
      manager_correction: true,
      punch_id: punchId,
      clock_out_at: clockOutAt,
      notes,
      minutes_worked: result.punch.minutesWorked,
      timesheet_entry_id: result.timesheetEntryId,
    },
  });

  return result;
}

export async function startBreakFromPinSession(opts: {
  tenantId: string;
  fiStaffId: string;
  client?: SupabaseClient;
}): Promise<TimePunchBreak> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(opts.fiStaffId, "fiStaffId");
  const supabase = opts.client ?? supabaseAdmin();

  const openRow = await findOpenPunchRow(tid, fiStaffId, supabase);
  if (!openRow) throw new Error("No open clock punch. Sign in with your PIN first.");

  const punchId = String(openRow.id);
  const { data: existingBreak } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .select("id")
    .eq("tenant_id", tid)
    .eq("punch_id", punchId)
    .eq("status", "open")
    .maybeSingle();
  if (existingBreak) throw new Error("Break already in progress.");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .insert({
      tenant_id: tid,
      punch_id: punchId,
      break_start_at: nowIso,
      status: "open",
      source: "pin",
      metadata: {},
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await insertFiStaffPinAuditEvent({
    tenantId: tid,
    eventKind: "staff_pin.break_start",
    staffId: fiStaffId,
    detail: { punch_id: punchId, break_start_at: nowIso },
  });

  return mapBreak(data as BreakRow);
}

export async function endBreakFromPinSession(opts: {
  tenantId: string;
  fiStaffId: string;
  client?: SupabaseClient;
}): Promise<TimePunchBreak> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(opts.fiStaffId, "fiStaffId");
  const supabase = opts.client ?? supabaseAdmin();

  const openRow = await findOpenPunchRow(tid, fiStaffId, supabase);
  if (!openRow) throw new Error("No open clock punch.");

  const punchId = String(openRow.id);
  const { data: openBreak, error: findErr } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .select("*")
    .eq("tenant_id", tid)
    .eq("punch_id", punchId)
    .eq("status", "open")
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!openBreak) throw new Error("No break in progress.");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .update({
      break_end_at: nowIso,
      status: "closed",
      updated_at: nowIso,
    })
    .eq("tenant_id", tid)
    .eq("id", String((openBreak as BreakRow).id))
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const brk = mapBreak(data as BreakRow);
  await insertFiStaffPinAuditEvent({
    tenantId: tid,
    eventKind: "staff_pin.break_end",
    staffId: fiStaffId,
    detail: {
      punch_id: punchId,
      break_end_at: nowIso,
      break_minutes: brk.minutes,
    },
  });

  return brk;
}

export async function managerAddBreakToPunch(opts: {
  tenantId: string;
  punchId: string;
  breakStartAt: string;
  breakEndAt: string;
  notes: string;
  managerFiUserId: string;
  client?: SupabaseClient;
}): Promise<TimePunchBreak> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId");
  const punchId = assertNonEmptyUuid(opts.punchId, "punchId");
  const supabase = opts.client ?? supabaseAdmin();
  const breakStartAt = opts.breakStartAt.trim();
  const breakEndAt = opts.breakEndAt.trim();
  const notes = opts.notes.trim();
  if (!breakStartAt || !breakEndAt) throw new Error("Break start and end are required.");
  if (!notes) throw new Error("A note is required for manager break entries.");
  if (new Date(breakEndAt).getTime() <= new Date(breakStartAt).getTime()) {
    throw new Error("Break end must be after break start.");
  }

  const { data: punch, error: punchErr } = await supabase
    .from("fi_workforce_time_punches")
    .select("id, status, clock_in_at, clock_out_at")
    .eq("tenant_id", tid)
    .eq("id", punchId)
    .neq("status", "void")
    .maybeSingle();
  if (punchErr) throw new Error(punchErr.message);
  if (!punch) throw new Error("Punch not found.");

  const row = punch as {
    status: string;
    clock_in_at: string;
    clock_out_at: string | null;
  };
  const punchStart = new Date(row.clock_in_at).getTime();
  const punchEnd = row.clock_out_at
    ? new Date(row.clock_out_at).getTime()
    : Date.now();
  const brkStart = new Date(breakStartAt).getTime();
  const brkEnd = new Date(breakEndAt).getTime();
  if (brkStart < punchStart || brkEnd > punchEnd) {
    throw new Error("Break must fall within the punch window.");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_time_punch_breaks")
    .insert({
      tenant_id: tid,
      punch_id: punchId,
      break_start_at: breakStartAt,
      break_end_at: breakEndAt,
      status: "closed",
      source: "manager_correction",
      notes,
      metadata: { manager_corrected_by: opts.managerFiUserId },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return mapBreak(data as BreakRow);
}