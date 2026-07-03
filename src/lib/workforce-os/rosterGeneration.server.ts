import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import {
  copyPreviousWeekShifts,
  generateRosterFromStandardHours,
  mondayOfWeekIso,
  type GenerateRosterFromStandardHoursResult,
  type RosterShiftCandidate,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  loadActiveStandardHoursForTenant,
  resolveStandardHoursForStaff,
} from "@/src/lib/workforce-os/staffStandardHours.server";
import type { StandardHoursShiftSource } from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { FiStaffShiftRow } from "@/src/lib/workforce-os/workforceRostering.server";

export type RosterGenerationRunResult = GenerateRosterFromStandardHoursResult & {
  createdCount: number;
  replacedCount: number;
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
  createdBy?: string | null
): Promise<number> {
  if (!candidates.length) return 0;
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
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

async function cancelShiftsByIds(tenantId: string, shiftIds: string[]): Promise<number> {
  if (!shiftIds.length) return 0;
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("fi_staff_shifts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("tenant_id", tid)
    .in("id", shiftIds);
  if (error) throw new Error(error.message);
  return shiftIds.length;
}

export type GenerateRosterInput = {
  tenantId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  staffIds?: string[];
  overwriteGeneratedOnly?: boolean;
  createdBy?: string | null;
};

export async function generateRosterFromStandardHoursForTenant(
  input: GenerateRosterInput
): Promise<RosterGenerationRunResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffRows = await loadAllStaffForTenant(tid);
  const staffIds =
    input.staffIds?.length && input.staffIds.length > 0
      ? input.staffIds.map((id) => assertNonEmptyUuid(id, "staffId"))
      : staffRows.filter((s) => s.is_active).map((s) => s.id);

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

  const [existingShifts, blocksRaw] = await Promise.all([
    loadExistingShiftsInRange(tid, input.rangeStartIso, input.rangeEndIso, staffIds),
    loadAvailabilityBlocksInRange(tid, input.rangeStartIso, input.rangeEndIso, staffIds),
  ]);

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
  });

  const replacedCount = await cancelShiftsByIds(tid, plan.shiftIdsToReplace);
  const createdCount = await insertShiftCandidates(tid, plan.candidates, input.createdBy);

  return { ...plan, createdCount, replacedCount };
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
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const weekStart = mondayOfWeekIso(input.targetWeekStartIso.slice(0, 10));
  const prevStart = new Date(`${weekStart}T00:00:00.000Z`);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prevEnd = new Date(`${weekStart}T00:00:00.000Z`);
  prevEnd.setUTCDate(prevEnd.getUTCDate());

  const staffRows = await loadAllStaffForTenant(tid);
  const staffIds =
    input.staffIds?.length && input.staffIds.length > 0
      ? input.staffIds.map((id) => assertNonEmptyUuid(id, "staffId"))
      : staffRows.filter((s) => s.is_active).map((s) => s.id);

  const staffTimezoneById = new Map(
    staffRows.map((s) => [s.id, s.default_timezone?.trim() || "Australia/Perth"])
  );

  const existingShifts = await loadExistingShiftsInRange(
    tid,
    prevStart.toISOString(),
    prevEnd.toISOString(),
    staffIds
  );

  const candidates = copyPreviousWeekShifts({
    existingShifts,
    staffIds,
    targetWeekStartIso: weekStart,
    staffTimezoneById,
  });

  const createdCount = await insertShiftCandidates(tid, candidates, input.createdBy);
  return { createdCount, candidates };
}
