/**
 * WorkforceOS — roster manual adjustment reason codes and pure validation (no I/O).
 */

import type { StandardHoursShiftSource } from "@/src/lib/workforce-os/staffStandardHoursCore";

export const ROSTER_MANUAL_ADJUSTMENT_REASONS = [
  "sick_cover",
  "extra_surgery_cover",
  "training_shift",
  "admin_shift",
  "prp_clinic_cover",
  "manual_adjustment",
  "other",
] as const;

export type RosterManualAdjustmentReason = (typeof ROSTER_MANUAL_ADJUSTMENT_REASONS)[number];

export const ROSTER_SHIFT_CANCELLATION_REASONS = [
  "staff_sick",
  "clinic_closed",
  "surgery_cancelled",
  "duplicate_generated_shift",
  "replaced_by_another_staff_member",
  "created_in_error",
  "manual_adjustment",
  "clear_generated_roster",
  "other",
] as const;

export type RosterShiftCancellationReason = (typeof ROSTER_SHIFT_CANCELLATION_REASONS)[number];

/** User-facing cancellation reasons for roster shift drawer (excludes bulk-only codes). */
export const ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS = [
  "staff_sick",
  "clinic_closed",
  "surgery_cancelled",
  "duplicate_generated_shift",
  "replaced_by_another_staff_member",
  "created_in_error",
  "manual_adjustment",
  "other",
] as const;

export type RosterShiftDrawerCancellationReason =
  (typeof ROSTER_SHIFT_DRAWER_CANCELLATION_REASONS)[number];

export const ROSTER_SHIFT_CANCELLATION_REASON_REQUIRED_MESSAGE =
  "Please choose a cancellation reason before cancelling this shift.";

export const ROSTER_SHIFT_AUDIT_ACTION_TYPES = {
  SHIFT_CREATED_MANUAL: "shift_created_manual",
  SHIFT_UPDATED_MANUAL: "shift_updated_manual",
  SHIFT_CANCELLED: "shift_cancelled",
  SHIFT_REMOVED_GENERATED: "shift_removed_generated",
  STAFF_MARKED_SICK_FOR_SHIFT: "staff_marked_sick_for_shift",
  REPLACEMENT_SHIFT_CREATED: "replacement_shift_created",
} as const;

export type RosterShiftAuditActionType =
  (typeof ROSTER_SHIFT_AUDIT_ACTION_TYPES)[keyof typeof ROSTER_SHIFT_AUDIT_ACTION_TYPES];

export type RosterShiftSnapshot = {
  id: string;
  staff_id: string;
  clinic_id: string | null;
  shift_type: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  shift_source: StandardHoursShiftSource | string | null;
  adjustment_reason?: string | null;
  cancellation_reason?: string | null;
};

const GENERATED_SHIFT_SOURCES = new Set<StandardHoursShiftSource>(["standard_hours", "copy_week"]);

export function isGeneratedShiftSource(
  shiftSource: StandardHoursShiftSource | string | null | undefined
): boolean {
  return GENERATED_SHIFT_SOURCES.has((shiftSource ?? "manual") as StandardHoursShiftSource);
}

export function canClearGeneratedShift(shift: RosterShiftSnapshot): boolean {
  if (shift.status !== "scheduled") return false;
  return isGeneratedShiftSource(shift.shift_source);
}

export function canHardDeleteGeneratedDraftShift(shift: RosterShiftSnapshot): boolean {
  return shift.status === "scheduled" && isGeneratedShiftSource(shift.shift_source);
}

export function shiftSnapshotForAudit(shift: RosterShiftSnapshot): Record<string, unknown> {
  return {
    id: shift.id,
    staff_id: shift.staff_id,
    clinic_id: shift.clinic_id,
    shift_type: shift.shift_type,
    starts_at: shift.starts_at,
    ends_at: shift.ends_at,
    status: shift.status,
    notes: shift.notes,
    shift_source: shift.shift_source,
    adjustment_reason: shift.adjustment_reason ?? null,
    cancellation_reason: shift.cancellation_reason ?? null,
  };
}

export function formatRosterAdjustmentReasonLabel(reason: string): string {
  return reason.replace(/_/g, " ");
}

/** Optional cancellation notes for fi_roster_shift_audit_events.metadata (omitted when blank). */
export function rosterShiftCancellationAuditMetadata(
  notes?: string | null
): Record<string, unknown> | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  return { notes: trimmed };
}
