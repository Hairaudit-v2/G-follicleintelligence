import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  listAwardLoadingPlaceholders,
  listWorkforceWageProfiles,
} from "@/src/lib/workforce/wageProfile.server";
import {
  normalizeWageRateType,
  resolveAwardLoadingsForProfile,
  type AwardLoadingSnapshot,
  type WorkforceWageProfile,
} from "@/src/lib/workforce/wageProfileCore";

import {
  addDaysIso,
  computeDailyRosterCost,
  computeLabourEfficiencyMetrics,
  computeProcedureLabourCosts,
  computeSurgeryTeamCost,
  computeWeeklyWageExposure,
  shiftMinutesBetween,
  type ShiftCostIntelligenceSnapshot,
  type ShiftCostLine,
} from "./shiftCostIntelligenceCore";

type StaffMemberRow = { id: string; fi_staff_id: string | null; full_name: string };

type WageCostContext = {
  profiles: WorkforceWageProfile[];
  placeholders: Awaited<ReturnType<typeof listAwardLoadingPlaceholders>>;
  profileByFiStaff: Map<string, WorkforceWageProfile>;
  profileByMember: Map<string, WorkforceWageProfile>;
  memberByFiStaff: Map<string, StaffMemberRow>;
};

async function loadWageCostContext(
  tenantId: string,
  client: SupabaseClient
): Promise<WageCostContext> {
  const [profiles, placeholders, membersRes] = await Promise.all([
    listWorkforceWageProfiles(tenantId, client),
    listAwardLoadingPlaceholders(tenantId, client),
    client
      .from("fi_staff_members")
      .select("id, fi_staff_id, full_name")
      .eq("tenant_id", tenantId)
      .is("archived_at", null),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);

  const memberByFiStaff = new Map<string, StaffMemberRow>();
  for (const raw of membersRes.data ?? []) {
    const m = raw as StaffMemberRow;
    if (m.fi_staff_id) memberByFiStaff.set(String(m.fi_staff_id), m);
  }

  return {
    profiles,
    placeholders,
    profileByFiStaff: new Map(
      profiles.filter((p) => p.fiStaffId).map((p) => [p.fiStaffId as string, p])
    ),
    profileByMember: new Map(profiles.map((p) => [p.staffMemberId, p])),
    memberByFiStaff,
  };
}

function resolveStaffWage(
  ctx: WageCostContext,
  fiStaffId: string
): {
  staffMemberId: string;
  fullName: string;
  rateType: ReturnType<typeof normalizeWageRateType>;
  baseRateCents: number;
  awardLoadings: AwardLoadingSnapshot[];
} {
  const member = ctx.memberByFiStaff.get(fiStaffId);
  const profile =
    ctx.profileByFiStaff.get(fiStaffId) ??
    (member ? ctx.profileByMember.get(String(member.id)) : undefined);

  const awardLoadings = profile
    ? resolveAwardLoadingsForProfile({
        awardCode: profile.awardCode,
        awardLoadingCodes: profile.awardLoadingCodes,
        placeholders: ctx.placeholders,
      })
    : [];

  return {
    staffMemberId: member ? String(member.id) : fiStaffId,
    fullName: member?.full_name ?? "Unknown staff",
    rateType: profile?.rateType ?? "hourly",
    baseRateCents: profile?.baseRateCents ?? 0,
    awardLoadings,
  };
}

function buildShiftLine(
  ctx: WageCostContext,
  input: {
    shiftId: string | null;
    fiStaffId: string;
    shiftType: string;
    startsAt: string;
    endsAt: string;
  }
): Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile"> {
  const wage = resolveStaffWage(ctx, input.fiStaffId);
  return {
    shiftId: input.shiftId,
    staffMemberId: wage.staffMemberId,
    fiStaffId: input.fiStaffId,
    fullName: wage.fullName,
    shiftType: input.shiftType,
    minutesWorked: shiftMinutesBetween(input.startsAt, input.endsAt),
    rateType: wage.rateType,
    baseRateCents: wage.baseRateCents,
    awardLoadings: wage.awardLoadings,
  };
}

function dayBoundsUtc(dateIso: string): { start: string; end: string } {
  return {
    start: `${dateIso}T00:00:00.000Z`,
    end: `${dateIso}T23:59:59.999Z`,
  };
}

function procedureMinutes(
  scheduledStart: string | null,
  scheduledEnd: string | null,
  fallbackMinutes = 480
): number {
  if (scheduledStart && scheduledEnd) {
    const mins = shiftMinutesBetween(scheduledStart, scheduledEnd);
    if (mins > 0) return mins;
  }
  return fallbackMinutes;
}

function procedureLabel(metadata: Record<string, unknown> | null, surgeryId: string): string {
  const meta = metadata ?? {};
  const name =
    (typeof meta.procedure_name === "string" && meta.procedure_name) ||
    (typeof meta.procedure_type === "string" && meta.procedure_type) ||
    (typeof meta.procedure_code === "string" && meta.procedure_code);
  return name ? String(name) : `Surgery ${surgeryId.slice(0, 8)}`;
}

async function loadShiftsForDate(
  tenantId: string,
  workDate: string,
  client: SupabaseClient
): Promise<
  {
    id: string;
    staff_id: string;
    shift_type: string;
    starts_at: string;
    ends_at: string;
  }[]
> {
  const { start, end } = dayBoundsUtc(workDate);
  const { data, error } = await client
    .from("fi_staff_shifts")
    .select("id, staff_id, shift_type, starts_at, ends_at, status")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled")
    .gte("starts_at", start)
    .lte("starts_at", end);
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as {
    id: string;
    staff_id: string;
    shift_type: string;
    starts_at: string;
    ends_at: string;
  }[];
}

export async function loadShiftCostIntelligence(
  tenantId: string,
  workDate?: string | null,
  client?: SupabaseClient
): Promise<ShiftCostIntelligenceSnapshot> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const date = workDate?.trim() || new Date().toISOString().slice(0, 10);
  const ctx = await loadWageCostContext(tid, supabase);

  const [shifts, surgeriesRes, assignmentsRes] = await Promise.all([
    loadShiftsForDate(tid, date, supabase),
    supabase
      .from("fi_surgeries")
      .select(
        "id, scheduled_date, scheduled_start_at, scheduled_end_at, status, metadata"
      )
      .eq("tenant_id", tid)
      .eq("scheduled_date", date)
      .neq("status", "cancelled"),
    supabase
      .from("fi_staff_event_assignments")
      .select("id, event_id, staff_id, assigned_role, assignment_status")
      .eq("tenant_id", tid)
      .eq("event_source", "surgery")
      .neq("assignment_status", "cancelled"),
  ]);

  if (surgeriesRes.error && !surgeriesRes.error.message?.includes("does not exist")) {
    throw new Error(surgeriesRes.error.message);
  }
  if (assignmentsRes.error && !assignmentsRes.error.message?.includes("does not exist")) {
    throw new Error(assignmentsRes.error.message);
  }

  const surgeries = (surgeriesRes.data ?? []) as {
    id: string;
    scheduled_date: string;
    scheduled_start_at: string | null;
    scheduled_end_at: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
  }[];

  const surgeryIds = new Set(surgeries.map((s) => String(s.id)));
  const assignments = ((assignmentsRes.data ?? []) as {
    event_id: string | null;
    staff_id: string;
    assigned_role: string;
  }[]).filter((a) => a.event_id && surgeryIds.has(String(a.event_id)));

  const rosterLines = shifts.map((shift) =>
    buildShiftLine(ctx, {
      shiftId: String(shift.id),
      fiStaffId: String(shift.staff_id),
      shiftType: String(shift.shift_type),
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
    })
  );

  const dailyRoster = computeDailyRosterCost({ workDate: date, lines: rosterLines });

  const surgeryTeamLines: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">[] = [];
  for (const surgery of surgeries) {
    const mins = procedureMinutes(surgery.scheduled_start_at, surgery.scheduled_end_at);
    const start =
      surgery.scheduled_start_at ?? `${String(surgery.scheduled_date)}T08:00:00.000Z`;
    const end =
      surgery.scheduled_end_at ??
      new Date(new Date(start).getTime() + mins * 60_000).toISOString();

    const surgeryAssignments = assignments.filter(
      (a) => String(a.event_id) === String(surgery.id)
    );

    for (const assignment of surgeryAssignments) {
      surgeryTeamLines.push(
        buildShiftLine(ctx, {
          shiftId: null,
          fiStaffId: String(assignment.staff_id),
          shiftType: `surgery_team:${assignment.assigned_role}`,
          startsAt: start,
          endsAt: end,
        })
      );
    }
  }

  const surgeryTeam = computeSurgeryTeamCost({
    workDate: date,
    surgeryCount: surgeries.length,
    lines: surgeryTeamLines,
  });

  const procedures = computeProcedureLabourCosts({
    procedures: surgeries.map((surgery) => {
      const mins = procedureMinutes(surgery.scheduled_start_at, surgery.scheduled_end_at);
      const start =
        surgery.scheduled_start_at ?? `${String(surgery.scheduled_date)}T08:00:00.000Z`;
      const end =
        surgery.scheduled_end_at ??
        new Date(new Date(start).getTime() + mins * 60_000).toISOString();

      const surgeryAssignments = assignments.filter(
        (a) => String(a.event_id) === String(surgery.id)
      );

      return {
        surgeryId: String(surgery.id),
        scheduledDate: String(surgery.scheduled_date).slice(0, 10),
        procedureLabel: procedureLabel(surgery.metadata, String(surgery.id)),
        status: String(surgery.status),
        minutesWorked: mins,
        lines: surgeryAssignments.map((a) =>
          buildShiftLine(ctx, {
            shiftId: null,
            fiStaffId: String(a.staff_id),
            shiftType: `procedure:${a.assigned_role}`,
            startsAt: start,
            endsAt: end,
          })
        ),
      };
    }),
  });

  const efficiency = computeLabourEfficiencyMetrics(dailyRoster);

  const weekDays: { workDate: string; lines: Omit<ShiftCostLine, "grossCostCents" | "hasWageProfile">[] }[] =
    [];
  for (let i = 0; i < 7; i++) {
    const d = addDaysIso(date, i);
    const dayShifts = await loadShiftsForDate(tid, d, supabase);
    weekDays.push({
      workDate: d,
      lines: dayShifts.map((shift) =>
        buildShiftLine(ctx, {
          shiftId: String(shift.id),
          fiStaffId: String(shift.staff_id),
          shiftType: String(shift.shift_type),
          startsAt: shift.starts_at,
          endsAt: shift.ends_at,
        })
      ),
    });
  }

  const weeklyForecast = computeWeeklyWageExposure({ weekStart: date, days: weekDays });

  return {
    workDate: date,
    dailyRoster,
    surgeryTeam,
    procedures,
    efficiency,
    weeklyForecast,
  };
}