import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type {
  ExistingShiftForGeneration,
  RosterShiftCandidate,
} from "@/src/lib/workforce-os/rosterGenerationCore";

export const ROSTER_TX_OUTCOMES = {
  STANDARD_HOURS_SAVED: "standard_hours_saved",
  STANDARD_HOURS_SAVE_FAILED_NO_CHANGES: "standard_hours_save_failed_no_changes",
  ROSTER_REPLACE_COMMITTED: "roster_replace_committed",
  ROSTER_REPLACE_FAILED_NO_CHANGES: "roster_replace_failed_no_changes",
} as const;

export type RosterTxOutcome = (typeof ROSTER_TX_OUTCOMES)[keyof typeof ROSTER_TX_OUTCOMES];

const VALID_SHIFT_TYPES = new Set([
  "clinic_day",
  "surgery_day",
  "consultation_day",
  "procedure_day",
  "training_day",
  "admin_day",
  "on_call",
]);

export function validateRosterShiftCandidatesForReplace(input: {
  tenantId: string;
  staffIds: string[];
  rangeStartIso: string;
  rangeEndIso: string;
  candidates: RosterShiftCandidate[];
  shiftIdsToReplace: string[];
  existingShifts: ExistingShiftForGeneration[];
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    assertNonEmptyUuid(input.tenantId, "tenantId");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid tenantId.");
  }

  const rangeStartMs = Date.parse(input.rangeStartIso);
  const rangeEndMs = Date.parse(input.rangeEndIso);
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs)) {
    errors.push("Invalid roster date range.");
  } else if (rangeStartMs >= rangeEndMs) {
    errors.push("rangeStartIso must be before rangeEndIso.");
  }

  const staffIdSet = new Set(input.staffIds.map((id) => id.trim()));
  if (staffIdSet.size === 0) {
    errors.push("At least one staff member is required for roster generation.");
  }

  for (const staffId of staffIdSet) {
    try {
      assertNonEmptyUuid(staffId, "staffId");
    } catch {
      errors.push(`Invalid staffId: ${staffId}`);
    }
  }

  const existingById = new Map(input.existingShifts.map((s) => [s.id, s]));

  for (const shiftId of input.shiftIdsToReplace) {
    const existing = existingById.get(shiftId);
    if (!existing) {
      errors.push(`Shift to replace not found in range: ${shiftId}`);
      continue;
    }
    if ((existing.shift_source ?? "manual") !== "standard_hours") {
      errors.push(`Shift ${shiftId} is not an eligible generated standard-hours shift.`);
    }
    if (existing.status === "cancelled") {
      errors.push(`Shift ${shiftId} is already cancelled.`);
    }
  }

  for (const [index, candidate] of input.candidates.entries()) {
    const label = `candidate[${index}]`;
    if (!staffIdSet.has(candidate.staff_id)) {
      errors.push(`${label}: staff_id is not in the generation scope.`);
    }
    try {
      assertNonEmptyUuid(candidate.staff_id, "staff_id");
    } catch {
      errors.push(`${label}: invalid staff_id.`);
    }
    if (!VALID_SHIFT_TYPES.has(candidate.shift_type)) {
      errors.push(`${label}: invalid shift_type ${candidate.shift_type}.`);
    }
    const startMs = Date.parse(candidate.starts_at);
    const endMs = Date.parse(candidate.ends_at);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      errors.push(`${label}: invalid shift window timestamps.`);
    } else if (startMs >= endMs) {
      errors.push(`${label}: starts_at must be before ends_at.`);
    } else if (Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndMs)) {
      if (startMs < rangeStartMs || startMs >= rangeEndMs) {
        errors.push(`${label}: shift starts outside roster range.`);
      }
    }
    if (candidate.shift_source !== "standard_hours") {
      errors.push(`${label}: only standard_hours generated shifts are supported.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function mapRosterShiftCandidatesToRpcRows(
  candidates: RosterShiftCandidate[],
  createdBy?: string | null
): Record<string, unknown>[] {
  return candidates.map((c) => ({
    staff_id: c.staff_id,
    clinic_id: c.clinic_id,
    shift_type: c.shift_type,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    shift_source: c.shift_source,
    notes: c.notes,
    created_by: createdBy?.trim() || null,
  }));
}

export function mapStandardHoursDaysToRpcRows(
  days: Array<{
    clinic_id?: string | null;
    weekday: number;
    cycle_week?: number | null;
    start_time?: string | null;
    end_time?: string | null;
    break_minutes?: number | null;
    shift_label?: string | null;
    role_code?: string | null;
    is_working_day: boolean;
  }>
): Record<string, unknown>[] {
  return days.map((day) => ({
    clinic_id: day.clinic_id?.trim() || null,
    weekday: day.weekday,
    cycle_week: day.cycle_week ?? 1,
    start_time: day.is_working_day ? day.start_time : null,
    end_time: day.is_working_day ? day.end_time : null,
    break_minutes: day.break_minutes ?? 0,
    shift_label: day.shift_label?.trim() || null,
    role_code: day.role_code?.trim() || null,
    is_working_day: day.is_working_day,
  }));
}
