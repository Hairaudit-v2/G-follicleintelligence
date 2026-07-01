import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveStaffMemberContext } from "@/src/lib/workforce/workforceStaffMemberResolve.server";

import {
  computeGrossLabourCostCents,
  computeSurgeryDayStaffingCost,
  DEFAULT_AWARD_LOADING_SEEDS,
  normalizeWageRateType,
  resolveAwardLoadingsForProfile,
  type AwardLoadingPlaceholder,
  type AwardLoadingSnapshot,
  type SurgeryDayStaffingCostSummary,
  type TimesheetEntry,
  type TimesheetEntryType,
  type TimesheetStatus,
  type WageRateType,
  type WorkforceWageProfile,
} from "./wageProfileCore";

function mapAwardLoading(row: Record<string, unknown>): AwardLoadingPlaceholder {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    awardCode: String(row.award_code),
    loadingCode: String(row.loading_code),
    displayName: String(row.display_name),
    loadingMultiplier: Number(row.loading_multiplier ?? 1),
    description: row.description != null ? String(row.description) : null,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapWageProfile(
  row: Record<string, unknown>,
  staffName?: string | null
): WorkforceWageProfile {
  const codes = row.award_loading_codes;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    staffMemberId: String(row.staff_member_id),
    fiStaffId: row.fi_staff_id != null ? String(row.fi_staff_id) : null,
    staffFullName: staffName ?? null,
    rateType: normalizeWageRateType(String(row.rate_type)),
    baseRateCents: Number(row.base_rate_cents),
    currency: String(row.currency ?? "AUD"),
    awardCode: row.award_code != null ? String(row.award_code) : null,
    awardLoadingCodes: Array.isArray(codes) ? codes.map((c) => String(c)) : [],
    effectiveFrom: String(row.effective_from).slice(0, 10),
    effectiveTo: row.effective_to != null ? String(row.effective_to).slice(0, 10) : null,
    isActive: Boolean(row.is_active),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapTimesheetEntry(
  row: Record<string, unknown>,
  staffName?: string | null
): TimesheetEntry {
  const loadings = row.award_loadings_snapshot;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    staffMemberId: String(row.staff_member_id),
    staffFullName: staffName ?? null,
    wageProfileId: row.wage_profile_id != null ? String(row.wage_profile_id) : null,
    shiftId: row.shift_id != null ? String(row.shift_id) : null,
    workDate: String(row.work_date).slice(0, 10),
    entryType: String(row.entry_type) as TimesheetEntryType,
    minutesWorked: Number(row.minutes_worked ?? 0),
    rateTypeSnapshot: normalizeWageRateType(String(row.rate_type_snapshot)),
    baseRateCentsSnapshot: Number(row.base_rate_cents_snapshot),
    awardLoadingsSnapshot: Array.isArray(loadings)
      ? (loadings as AwardLoadingSnapshot[])
      : [],
    grossCostCents: Number(row.gross_cost_cents ?? 0),
    status: String(row.status) as TimesheetStatus,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function loadStaffNameMap(
  tenantId: string,
  staffMemberIds: string[],
  client: SupabaseClient
): Promise<Map<string, string>> {
  if (staffMemberIds.length === 0) return new Map();
  const { data, error } = await client
    .from("fi_staff_members")
    .select("id, full_name")
    .eq("tenant_id", tenantId)
    .in("id", staffMemberIds);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((r) => [String((r as { id: string }).id), String((r as { full_name: string }).full_name)])
  );
}

export async function listAwardLoadingPlaceholders(
  tenantId: string,
  client?: SupabaseClient
): Promise<AwardLoadingPlaceholder[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_workforce_award_loading_placeholders")
    .select("*")
    .eq("tenant_id", tid)
    .order("award_code", { ascending: true })
    .order("loading_code", { ascending: true });
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapAwardLoading(r as Record<string, unknown>));
}

export async function ensureDefaultAwardLoadingPlaceholders(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const existing = await listAwardLoadingPlaceholders(tid, supabase);
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const rows = DEFAULT_AWARD_LOADING_SEEDS.map((seed) => ({
    tenant_id: tid,
    award_code: "PLACEHOLDER_AWARD",
    loading_code: seed.loadingCode,
    display_name: seed.displayName,
    loading_multiplier: seed.multiplier,
    description: "Sprint 2 placeholder — replace with tenant award configuration.",
    is_active: true,
    created_at: now,
    updated_at: now,
  }));
  const { error } = await supabase.from("fi_workforce_award_loading_placeholders").insert(rows);
  if (error && !error.message?.includes("does not exist")) throw new Error(error.message);
}

export async function upsertAwardLoadingPlaceholder(input: {
  tenantId: string;
  placeholderId?: string | null;
  awardCode: string;
  loadingCode: string;
  displayName: string;
  loadingMultiplier: number;
  description?: string | null;
  client?: SupabaseClient;
}): Promise<AwardLoadingPlaceholder> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const payload = {
    tenant_id: tid,
    award_code: input.awardCode.trim(),
    loading_code: input.loadingCode.trim(),
    display_name: input.displayName.trim(),
    loading_multiplier: input.loadingMultiplier,
    description: input.description?.trim() || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  if (!payload.award_code || !payload.loading_code || !payload.display_name) {
    throw new Error("awardCode, loadingCode, and displayName are required.");
  }
  if (!Number.isFinite(payload.loading_multiplier) || payload.loading_multiplier <= 0) {
    throw new Error("loadingMultiplier must be positive.");
  }

  const pid = input.placeholderId?.trim();
  if (pid) {
    const { data, error } = await supabase
      .from("fi_workforce_award_loading_placeholders")
      .update(payload)
      .eq("tenant_id", tid)
      .eq("id", pid)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapAwardLoading(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("fi_workforce_award_loading_placeholders")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAwardLoading(data as Record<string, unknown>);
}

export async function listWorkforceWageProfiles(
  tenantId: string,
  client?: SupabaseClient
): Promise<WorkforceWageProfile[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_workforce_wage_profiles")
    .select("*")
    .eq("tenant_id", tid)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const nameMap = await loadStaffNameMap(
    tid,
    rows.map((r) => String(r.staff_member_id)),
    supabase
  );
  return rows.map((r) =>
    mapWageProfile(r, nameMap.get(String(r.staff_member_id)) ?? null)
  );
}

export async function upsertWorkforceWageProfile(input: {
  tenantId: string;
  staffMemberId: string;
  wageProfileId?: string | null;
  rateType: WageRateType;
  baseRateCents: number;
  currency?: string;
  awardCode?: string | null;
  awardLoadingCodes?: string[];
  effectiveFrom?: string | null;
  notes?: string | null;
  client?: SupabaseClient;
}): Promise<WorkforceWageProfile> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const ctx = await resolveStaffMemberContext(tid, input.staffMemberId.trim(), supabase);
  if (!ctx) throw new Error("Staff member not found.");

  if (!Number.isFinite(input.baseRateCents) || input.baseRateCents <= 0) {
    throw new Error("baseRateCents must be positive.");
  }

  const now = new Date().toISOString();
  const payload = {
    tenant_id: tid,
    staff_member_id: ctx.staffMemberId,
    fi_staff_id: ctx.fiStaffId,
    rate_type: input.rateType,
    base_rate_cents: Math.round(input.baseRateCents),
    currency: (input.currency ?? "AUD").trim() || "AUD",
    award_code: input.awardCode?.trim() || null,
    award_loading_codes: input.awardLoadingCodes ?? [],
    effective_from: input.effectiveFrom?.trim() || new Date().toISOString().slice(0, 10),
    is_active: true,
    notes: input.notes?.trim() || null,
    updated_at: now,
  };

  const wid = input.wageProfileId?.trim();
  if (wid) {
    const { data, error } = await supabase
      .from("fi_workforce_wage_profiles")
      .update(payload)
      .eq("tenant_id", tid)
      .eq("id", wid)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapWageProfile(data as Record<string, unknown>, ctx.fullName);
  }

  const { data: existing } = await supabase
    .from("fi_workforce_wage_profiles")
    .select("id")
    .eq("tenant_id", tid)
    .eq("staff_member_id", ctx.staffMemberId)
    .eq("is_active", true)
    .is("effective_to", null)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("fi_workforce_wage_profiles")
      .update(payload)
      .eq("tenant_id", tid)
      .eq("id", String((existing as { id: string }).id))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapWageProfile(data as Record<string, unknown>, ctx.fullName);
  }

  const { data, error } = await supabase
    .from("fi_workforce_wage_profiles")
    .insert({ ...payload, metadata: {}, created_at: now })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapWageProfile(data as Record<string, unknown>, ctx.fullName);
}

export async function listTimesheetEntries(
  tenantId: string,
  options?: { limit?: number; workDate?: string | null },
  client?: SupabaseClient
): Promise<TimesheetEntry[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  let q = supabase
    .from("fi_workforce_timesheet_entries")
    .select("*")
    .eq("tenant_id", tid)
    .neq("status", "void")
    .order("work_date", { ascending: false })
    .order("updated_at", { ascending: false });
  if (options?.workDate?.trim()) q = q.eq("work_date", options.workDate.trim());
  if (options?.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const nameMap = await loadStaffNameMap(
    tid,
    rows.map((r) => String(r.staff_member_id)),
    supabase
  );
  return rows.map((r) =>
    mapTimesheetEntry(r, nameMap.get(String(r.staff_member_id)) ?? null)
  );
}

export async function createTimesheetEntry(input: {
  tenantId: string;
  staffMemberId: string;
  workDate: string;
  entryType?: TimesheetEntryType;
  minutesWorked: number;
  shiftId?: string | null;
  notes?: string | null;
  client?: SupabaseClient;
}): Promise<TimesheetEntry> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const ctx = await resolveStaffMemberContext(tid, input.staffMemberId.trim(), supabase);
  if (!ctx) throw new Error("Staff member not found.");

  const workDate = input.workDate.trim();
  if (!workDate) throw new Error("workDate is required.");

  const profiles = await listWorkforceWageProfiles(tid, supabase);
  const profile = profiles.find((p) => p.staffMemberId === ctx.staffMemberId) ?? null;
  if (!profile) throw new Error("No active wage profile for staff member.");

  const placeholders = await listAwardLoadingPlaceholders(tid, supabase);
  const awardLoadings = resolveAwardLoadingsForProfile({
    awardCode: profile.awardCode,
    awardLoadingCodes: profile.awardLoadingCodes,
    placeholders,
  });
  const grossCostCents = computeGrossLabourCostCents({
    rateType: profile.rateType,
    baseRateCents: profile.baseRateCents,
    minutesWorked: input.minutesWorked,
    awardLoadings,
  });

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_timesheet_entries")
    .insert({
      tenant_id: tid,
      staff_member_id: ctx.staffMemberId,
      wage_profile_id: profile.id,
      shift_id: input.shiftId?.trim() || null,
      work_date: workDate,
      entry_type: input.entryType ?? "regular",
      minutes_worked: Math.max(0, Math.floor(input.minutesWorked)),
      rate_type_snapshot: profile.rateType,
      base_rate_cents_snapshot: profile.baseRateCents,
      award_loadings_snapshot: awardLoadings,
      gross_cost_cents: grossCostCents,
      status: "draft",
      notes: input.notes?.trim() || null,
      metadata: {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTimesheetEntry(data as Record<string, unknown>, ctx.fullName);
}

function shiftMinutes(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

export async function computeSurgeryDayStaffingCostForDate(
  tenantId: string,
  workDate: string,
  client?: SupabaseClient
): Promise<SurgeryDayStaffingCostSummary> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const date = workDate.trim();
  const supabase = client ?? supabaseAdmin();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const [shiftRes, profiles, placeholders, membersRes] = await Promise.all([
    supabase
      .from("fi_staff_shifts")
      .select("id, staff_id, shift_type, starts_at, ends_at, status")
      .eq("tenant_id", tid)
      .eq("shift_type", "surgery_day")
      .neq("status", "cancelled")
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd),
    listWorkforceWageProfiles(tid, supabase),
    listAwardLoadingPlaceholders(tid, supabase),
    supabase
      .from("fi_staff_members")
      .select("id, fi_staff_id, full_name")
      .eq("tenant_id", tid)
      .is("archived_at", null),
  ]);

  if (shiftRes.error) {
    if (shiftRes.error.message?.includes("does not exist")) {
      return computeSurgeryDayStaffingCost({ workDate: date, lines: [] });
    }
    throw new Error(shiftRes.error.message);
  }
  if (membersRes.error) throw new Error(membersRes.error.message);

  const profileByFiStaff = new Map(
    profiles
      .filter((p) => p.fiStaffId)
      .map((p) => [p.fiStaffId as string, p])
  );
  const profileByMember = new Map(profiles.map((p) => [p.staffMemberId, p]));
  const memberByFiStaff = new Map(
    (membersRes.data ?? []).map((m) => [
      String((m as { fi_staff_id: string | null }).fi_staff_id ?? ""),
      m as { id: string; fi_staff_id: string | null; full_name: string },
    ])
  );

  const lines = (shiftRes.data ?? []).map((raw) => {
    const shift = raw as {
      id: string;
      staff_id: string;
      shift_type: string;
      starts_at: string;
      ends_at: string;
    };
    const member = memberByFiStaff.get(shift.staff_id);
    const profile =
      profileByFiStaff.get(shift.staff_id) ??
      (member ? profileByMember.get(String(member.id)) : undefined);
    const minutesWorked = shiftMinutes(shift.starts_at, shift.ends_at);
    const awardLoadings = profile
      ? resolveAwardLoadingsForProfile({
          awardCode: profile.awardCode,
          awardLoadingCodes: profile.awardLoadingCodes,
          placeholders,
        })
      : [];

    return {
      staffMemberId: member ? String(member.id) : shift.staff_id,
      fiStaffId: shift.staff_id,
      fullName: member?.full_name ?? "Unknown staff",
      shiftId: String(shift.id),
      shiftType: String(shift.shift_type),
      minutesWorked,
      rateType: profile?.rateType ?? "hourly",
      baseRateCents: profile?.baseRateCents ?? 0,
      awardLoadings,
    };
  });

  return computeSurgeryDayStaffingCost({ workDate: date, lines });
}

export async function listActiveStaffForWageProfiles(
  tenantId: string,
  client?: SupabaseClient
): Promise<{ id: string; fullName: string; fiStaffId: string | null; hasWageProfile: boolean }[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const [membersRes, profiles] = await Promise.all([
    supabase
      .from("fi_staff_members")
      .select("id, full_name, fi_staff_id, employment_status")
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .is("merged_into", null)
      .order("full_name", { ascending: true }),
    listWorkforceWageProfiles(tid, supabase),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);

  const profileStaffIds = new Set(profiles.map((p) => p.staffMemberId));
  return (membersRes.data ?? [])
    .filter((m) => {
      const status = String((m as { employment_status: string }).employment_status ?? "active");
      return !["merged", "terminated", "resigned", "contract_ended"].includes(status);
    })
    .map((m) => ({
      id: String((m as { id: string }).id),
      fullName: String((m as { full_name: string }).full_name),
      fiStaffId:
        (m as { fi_staff_id: string | null }).fi_staff_id != null
          ? String((m as { fi_staff_id: string | null }).fi_staff_id)
          : null,
      hasWageProfile: profileStaffIds.has(String((m as { id: string }).id)),
    }));
}