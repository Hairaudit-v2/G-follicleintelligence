import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import {
  copyPreviousRosterPeriodShifts,
  generateRosterFromStandardHours,
  mondayOfWeekIso,
  type ExistingShiftForGeneration,
  type GenerateRosterFromStandardHoursResult,
  type RosterShiftCandidate,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  rosterDateRangeFromPeriodStart,
  rosterPeriodDayCount,
  type RosterCadence,
} from "@/src/lib/workforce/rosterCadencePolicyCore";
import { loadWorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicy.server";
import {
  loadRosterStaffEligibilityContext,
  resolveDefaultRosterStaffIds,
} from "@/src/lib/workforce-os/rosterEligibleStaff.server";
import {
  loadActiveStandardHoursForTenant,
  resolveStandardHoursForStaff,
} from "@/src/lib/workforce-os/staffStandardHours.server";
import type { StandardHoursShiftSource } from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  mapRosterShiftCandidatesToRpcRows,
  ROSTER_TX_OUTCOMES,
  validateRosterShiftCandidatesForReplace,
} from "@/src/lib/workforce-os/rosterTxCore";
import type { FiStaffShiftRow } from "@/src/lib/workforce-os/workforceRostering.server";

export type RosterGenerationRunResult = GenerateRosterFromStandardHoursResult & {
  outcome:
    | typeof ROSTER_TX_OUTCOMES.ROSTER_REPLACE_COMMITTED
    | typeof ROSTER_TX_OUTCOMES.ROSTER_REPLACE_FAILED_NO_CHANGES;
  createdCount: number;
  replacedCount: number;
  validationErrors?: string[];
};

function mapShiftRow(row: Record<string, unknown>): FiStaffShiftRow & { shift_source?: StandardHoursShiftSource } {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    staff_id: String(row.staff_id),
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    shift_type: String(row.shift_type),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    status: row.status as FiStaffShiftRow["status"],
    notes: row.notes != null ? String(row.notes) : null,
    shift_source: (row.shift_source as StandardHoursShiftSource | undefined) ?? "manual",
  };
}

async function loadExistingShiftsInRange(
  tenantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  staffIds?: string[]
) {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  let query = supabase
    .from("fi_staff_shifts")
    .select("*")
    .eq("tenant_id", tid)
    .neq("status", "cancelled")
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndIso);

  if (staffIds?.length) {
    query = query.in("staff_id", staffIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapShiftRow(r as Record<string, unknown>));
}

async function loadAvailabilityBlocksInRange(
  tenantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  staffIds?: string[]
) {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  let query = supabase
    .from("fi_staff_availability_blocks")
    .select("*")
    .eq("tenant_id", tid)
    .eq("status", "active")
    .gte("starts_at", rangeStartIso)
    .lt("ends_at", rangeEndIso);

  if (staffIds?.length) {
    query = query.in("staff_id", staffIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    block_type: (r as Record<string, unknown>).block_type as import("@/src/lib/workforce-os/workforceRosteringEngine").AvailabilityBlockType,
    starts_at: String((r as Record<string, unknown>).starts_at),
    ends_at: String((r as Record<string, unknown>).ends_at),
    status: String((r as Record<string, unknown>).status),
    staff_id: String((r as Record<string, unknown>).staff_id),
  }));
}

async function insertShiftCandidates(
  tenantId: string,
  candidates: RosterShiftCandidate[],
  createdBy?: string | null,
  supabaseClientForTests?: SupabaseClient
): Promise<number> {
  if (!candidates.length) return 0;
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseClientForTests ?? supabaseAdmin();
  const rows = candidates.map((c) => ({
    tenant_id: tid,
    staff_id: c.staff_id,
    clinic_id: c.clinic_id,
    shift_type: c.shift_type,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    shift_source: c.shift_source,
    notes: c.notes,
    created_by: createdBy?.trim() || null,
  }));
  const { error } = await supabase.from("fi_staff_shifts").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

/** @internal Exported for unit tests verifying `created_by` FK resolution. */
export async function insertShiftCandidatesForTests(
  tenantId: string,
  candidates: RosterShiftCandidate[],
  createdBy: string | null | undefined,
  supabaseClientForTests: SupabaseClient
): Promise<number> {
  return insertShiftCandidates(tenantId, candidates, createdBy, supabaseClientForTests);
}

export type GenerateRosterInput = {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  staffIds?: string[];
  overwriteGeneratedOnly?: boolean;
  createdBy?: string | null;
  supabaseClientForTests?: SupabaseClient;
};

export async function generateRosterFromStandardHoursForTenant(
  input: GenerateRosterInput
): Promise<RosterGenerationRunResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffRows = await loadAllStaffForTenant(tid);
  const rosterPolicy = await loadWorkforceRosterPlanningPolicy(tid);
  const periodStart = input.rangeStartIso.slice(0, 10);
  const periodDayDates = rosterDateRangeFromPeriodStart(
    periodStart,
    rosterPolicy.rosterCadence,
    rosterPolicy.rosterWeekStartDay
  ).periodDayDates;

  const blocksRaw = await loadAvailabilityBlocksInRange(
    tid,
    input.rangeStartIso,
    input.rangeEndIso
  );

  const eligibilityContext = await loadRosterStaffEligibilityContext(tid, {
    periodDayDates,
    staffRows,
    availabilityBlocks: blocksRaw.map((block) => ({
      staff_id: block.staff_id,
      block_type: block.block_type,
      starts_at: block.starts_at,
      ends_at: block.ends_at,
      status: block.status,
    })),
  });

  const staffIds = resolveDefaultRosterStaffIds(
    staffRows,
    input.staffIds,
    eligibilityContext.eligibilityByStaffId
  );

  const standardHoursByStaff = await loadActiveStandardHoursForTenant(tid, staffIds);

  for (const staff of staffRows) {
    if (!staffIds.includes(staff.id)) continue;
    if (standardHoursByStaff.has(staff.id)) continue;
    const resolved = await resolveStandardHoursForStaff(tid, staff.id, staff.working_hours);
    if (resolved.length) standardHoursByStaff.set(staff.id, resolved);
  }

  const staffTimezoneById = new Map(
    staffRows.map((s) => [s.id, s.default_timezone?.trim() || "Australia/Perth"])
  );

  const existingShifts = await loadExistingShiftsInRange(
    tid,
    input.rangeStartIso,
    input.rangeEndIso,
    staffIds
  );

  const plan = generateRosterFromStandardHours({
    tenantId: tid,
    staffIds,
    standardHoursByStaff,
    staffTimezoneById,
    rangeStartIso: input.rangeStartIso,
    rangeEndIso: input.rangeEndIso,
    existingShifts,
    availabilityBlocks: blocksRaw,
    overwriteGeneratedOnly: input.overwriteGeneratedOnly,
    rosterCadence: rosterPolicy.rosterCadence,
    rosterCycleAnchorDate: rosterPolicy.rosterCycleAnchorDate,
  });

  return applyRosterGenerationPlan({
    tenantId: tid,
    staffIds,
    rangeStartIso: input.rangeStartIso,
    rangeEndIso: input.rangeEndIso,
    plan,
    existingShifts,
    createdBy: input.createdBy,
    client: input.supabaseClientForTests,
  });
}

/** @internal Exported for transaction-safety unit tests. */
export async function applyRosterGenerationPlan(input: {
  tenantId: string;
  staffIds: string[];
  rangeStartIso: string;
  rangeEndIso: string;
  plan: GenerateRosterFromStandardHoursResult;
  existingShifts: ExistingShiftForGeneration[];
  createdBy?: string | null;
  client?: SupabaseClient;
}): Promise<RosterGenerationRunResult> {
  const validation = validateRosterShiftCandidatesForReplace({
    tenantId: input.tenantId,
    staffIds: input.staffIds,
    rangeStartIso: input.rangeStartIso,
    rangeEndIso: input.rangeEndIso,
    candidates: input.plan.candidates,
    shiftIdsToReplace: input.plan.shiftIdsToReplace,
    existingShifts: input.existingShifts,
  });

  if (!validation.valid) {
    return {
      ...input.plan,
      outcome: ROSTER_TX_OUTCOMES.ROSTER_REPLACE_FAILED_NO_CHANGES,
      createdCount: 0,
      replacedCount: 0,
      validationErrors: validation.errors,
    };
  }

  const supabase = input.client ?? supabaseAdmin();
  const { data: rpcData, error: rpcErr } = await supabase.rpc("fi_replace_generated_roster_shifts", {
    p_tenant_id: input.tenantId,
    p_shift_ids_to_cancel: input.plan.shiftIdsToReplace,
    p_new_shifts: mapRosterShiftCandidatesToRpcRows(input.plan.candidates, input.createdBy),
    p_created_by: input.createdBy?.trim() || null,
  });

  if (rpcErr || !(rpcData as { ok?: boolean } | null)?.ok) {
    return {
      ...input.plan,
      outcome: ROSTER_TX_OUTCOMES.ROSTER_REPLACE_FAILED_NO_CHANGES,
      createdCount: 0,
      replacedCount: 0,
      validationErrors: [rpcErr?.message ?? "Roster replace transaction failed."],
    };
  }

  const payload = rpcData as { cancelled_count?: number; inserted_count?: number };
  return {
    ...input.plan,
    outcome: ROSTER_TX_OUTCOMES.ROSTER_REPLACE_COMMITTED,
    createdCount: Number(payload.inserted_count ?? input.plan.candidates.length),
    replacedCount: Number(payload.cancelled_count ?? input.plan.shiftIdsToReplace.length),
  };
}

export type CopyPreviousRosterPeriodInput = {
  tenantId: string;
  targetPeriodStartIso: string;
  cadence?: RosterCadence;
  staffIds?: string[];
  createdBy?: string | null;
};

export async function copyPreviousRosterPeriodForTenant(
  input: CopyPreviousRosterPeriodInput
): Promise<{ createdCount: number; candidates: RosterShiftCandidate[]; cadence: RosterCadence }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const rosterPolicy = await loadWorkforceRosterPlanningPolicy(tid);
  const cadence = input.cadence ?? rosterPolicy.rosterCadence;
  const periodStart = input.targetPeriodStartIso.slice(0, 10);
  const dayCount = rosterPeriodDayCount(periodStart, cadence);
  const range = rosterDateRangeFromPeriodStart(periodStart, cadence, rosterPolicy.rosterWeekStartDay);
  const prevStart = new Date(range.startsAt);
  prevStart.setUTCDate(prevStart.getUTCDate() - dayCount);
  const prevEnd = new Date(range.startsAt);

  const staffRows = await loadAllStaffForTenant(tid);
  const eligibilityContext = await loadRosterStaffEligibilityContext(tid, {
    periodDayDates: range.periodDayDates,
    staffRows,
  });
  const staffIds = resolveDefaultRosterStaffIds(
    staffRows,
    input.staffIds,
    eligibilityContext.eligibilityByStaffId
  );

  const staffTimezoneById = new Map(
    staffRows.map((s) => [s.id, s.default_timezone?.trim() || "Australia/Perth"])
  );

  const existingShifts = await loadExistingShiftsInRange(
    tid,
    prevStart.toISOString(),
    prevEnd.toISOString(),
    staffIds
  );

  const candidates = copyPreviousRosterPeriodShifts({
    existingShifts,
    staffIds,
    targetPeriodStartIso: periodStart,
    staffTimezoneById,
    cadence,
  });

  const createdCount = await insertShiftCandidates(tid, candidates, input.createdBy);
  return { createdCount, candidates, cadence };
}

export type CopyPreviousWeekInput = {
  tenantId: string;
  targetWeekStartIso: string;
  staffIds?: string[];
  createdBy?: string | null;
};

export async function copyPreviousWeekRosterForTenant(
  input: CopyPreviousWeekInput
): Promise<{ createdCount: number; candidates: RosterShiftCandidate[] }> {
  const result = await copyPreviousRosterPeriodForTenant({
    tenantId: input.tenantId,
    targetPeriodStartIso: mondayOfWeekIso(input.targetWeekStartIso.slice(0, 10)),
    cadence: "weekly",
    staffIds: input.staffIds,
    createdBy: input.createdBy,
  });
  return { createdCount: result.createdCount, candidates: result.candidates };
}
