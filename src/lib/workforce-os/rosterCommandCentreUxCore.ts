/**
 * WorkforceOS Roster Command Centre — pure UX helpers (no I/O).
 */

import {
  calendarDateStringFromInstant,
  normalizeCalendarTimezone,
  parseIsoUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import {
  shiftTypeFromStandardDay,
  weekdayIndexFromLocalDate,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  computeStandardHoursWeeklyTotal,
  normaliseCycleWeek,
  staffHasConfiguredStandardHours,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import type { RosterCadence } from "@/src/lib/workforce/rosterCadencePolicyCore";
import { resolveFortnightCycleWeek } from "@/src/lib/workforce/rosterCadencePolicyCore";
import {
  buildStaffStandardHoursEditorHref,
  buildStaffStandardHoursReturnToRosterHref,
  STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
} from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import {
  canEditRosterShift,
  rosterShiftEditRequiresReason,
  type RosterShiftSnapshot,
} from "@/src/lib/workforce-os/rosterManualAdjustmentsCore";

export type RosterCellClickIntent = "open_cell_actions";

export type RosterCellClickOutcome =
  | { outcome: "open_drawer"; mode: "cell-actions" }
  | { outcome: "deny"; message: string };

export type RosterEmptyCellLabel = "add_shift" | "generate_or_add_shift";

export type RosterCommandCentreDrawerState =
  | { kind: "closed" }
  | { kind: "setup_missing_standard_hours" }
  | { kind: "standard_hours"; staffMemberId: string }
  | {
      kind: "shift";
      mode: "add" | "edit" | "cell-actions";
      staffMemberId: string;
      localDate: string;
      shiftId: string | null;
    };

export function closeRosterDrawer(): RosterCommandCentreDrawerState {
  return { kind: "closed" };
}

export function openRosterMissingStandardHoursSetupDrawer(): RosterCommandCentreDrawerState {
  return { kind: "setup_missing_standard_hours" };
}

export function openRosterStandardHoursDrawer(staffMemberId: string): RosterCommandCentreDrawerState {
  return { kind: "standard_hours", staffMemberId };
}

export function openRosterShiftDrawer(input: {
  mode: "add" | "edit" | "cell-actions";
  staffMemberId: string;
  localDate: string;
  shiftId: string | null;
}): RosterCommandCentreDrawerState {
  return { kind: "shift", ...input };
}

export function rosterDrawerRequiresStaff(
  drawer: RosterCommandCentreDrawerState
): drawer is
  | { kind: "standard_hours"; staffMemberId: string }
  | {
      kind: "shift";
      mode: "add" | "edit" | "cell-actions";
      staffMemberId: string;
      localDate: string;
      shiftId: string | null;
    } {
  return drawer.kind === "standard_hours" || drawer.kind === "shift";
}

export function resolveRosterDrawerStaffMemberId(
  drawer: RosterCommandCentreDrawerState
): string | null {
  if (!rosterDrawerRequiresStaff(drawer)) return null;
  return drawer.staffMemberId;
}

export function resolveRosterDrawerStaffName(
  drawer: RosterCommandCentreDrawerState,
  staffOptions: Array<{ id: string; name: string }>
): string | null {
  const staffMemberId = resolveRosterDrawerStaffMemberId(drawer);
  if (!staffMemberId?.trim()) return null;
  return staffOptions.find((staff) => staff.id === staffMemberId)?.name ?? null;
}

export function resolveRosterPayloadWeekDayDates(payload: {
  periodDayDates?: string[];
  weekDayDates?: string[];
}): string[] {
  if (payload.periodDayDates?.length) return payload.periodDayDates;
  if (payload.weekDayDates?.length) return payload.weekDayDates;
  return [];
}

export function rosterStandardHoursDrawerIsOpen(
  drawer: RosterCommandCentreDrawerState
): drawer is { kind: "standard_hours"; staffMemberId: string } {
  return drawer.kind === "standard_hours";
}

export function resolveRosterCellClickIntent(input: {
  hasStandardHours: boolean;
}): RosterCellClickIntent {
  void input.hasStandardHours;
  return "open_cell_actions";
}

export function resolveRosterEmptyCellLabel(input: {
  hasStandardHours: boolean;
}): RosterEmptyCellLabel {
  return input.hasStandardHours ? "generate_or_add_shift" : "add_shift";
}

export function resolveRosterCellClickOutcome(input: {
  staffId: string;
  eligibleStaffIds: readonly string[];
  canManage: boolean;
  manageDeniedReason?: string;
  ineligibleMessage?: string;
}): RosterCellClickOutcome {
  const eligibleSet = new Set(input.eligibleStaffIds);
  if (!eligibleSet.has(input.staffId)) {
    return {
      outcome: "deny",
      message:
        input.ineligibleMessage ??
        "This staff member is not roster-eligible for this period.",
    };
  }
  if (!input.canManage) {
    return {
      outcome: "deny",
      message:
        input.manageDeniedReason ?? STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
    };
  }
  return { outcome: "open_drawer", mode: "cell-actions" };
}

export function staffHasWorkingStandardHoursForDate(input: {
  standardHours: StaffStandardHoursDayInput[] | undefined;
  localDate: string;
  rosterCadence?: RosterCadence;
  rosterCycleAnchorDate?: string;
}): boolean {
  const day = resolveStandardHoursDayForLocalDate(input);
  return Boolean(day?.is_working_day && day.start_time && day.end_time);
}

export function resolveStandardHoursDayForLocalDate(input: {
  standardHours: StaffStandardHoursDayInput[] | undefined;
  localDate: string;
  rosterCadence?: RosterCadence;
  rosterCycleAnchorDate?: string;
}): StaffStandardHoursDayInput | null {
  if (!input.standardHours?.length) return null;
  const weekday = weekdayIndexFromLocalDate(input.localDate);
  const cycleWeek =
    input.rosterCadence === "fortnightly"
      ? resolveFortnightCycleWeek(
          input.localDate,
          input.rosterCycleAnchorDate ?? "2026-01-05"
        )
      : 1;
  return (
    input.standardHours.find(
      (row) => row.weekday === weekday && normaliseCycleWeek(row.cycle_week) === cycleWeek
    ) ??
    input.standardHours.find(
      (row) => row.weekday === weekday && normaliseCycleWeek(row.cycle_week) === 1
    ) ??
    null
  );
}

export type RosterStandardHoursEditorNavigation =
  | { outcome: "navigate"; href: string }
  | { outcome: "deny"; reason: string };

export function resolveRosterStandardHoursEditorNavigation(input: {
  tenantId: string;
  staffMemberId: string;
  canManage: boolean;
  manageDeniedReason?: string;
  emptyStaffMessage?: string;
}): RosterStandardHoursEditorNavigation {
  const normalizedStaffMemberId = input.staffMemberId?.trim();
  if (!normalizedStaffMemberId) {
    return {
      outcome: "deny",
      reason: input.emptyStaffMessage ?? "Could not open standard hours for this staff member.",
    };
  }
  if (!input.canManage) {
    return {
      outcome: "deny",
      reason: input.manageDeniedReason ?? STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
    };
  }
  return {
    outcome: "navigate",
    href: buildStaffStandardHoursEditorHref(input.tenantId, normalizedStaffMemberId, {
      returnTo: buildStaffStandardHoursReturnToRosterHref(input.tenantId),
    }),
  };
}

export function pushRosterStandardHoursEditorNavigation(
  router: { push: (href: string) => void },
  input: Parameters<typeof resolveRosterStandardHoursEditorNavigation>[0]
): RosterStandardHoursEditorNavigation {
  const result = resolveRosterStandardHoursEditorNavigation(input);
  if (result.outcome === "navigate") router.push(result.href);
  return result;
}

export type RosterShiftDrawerDefaults = {
  staffId: string;
  clinicId: string;
  shiftType: string;
  startsAt: string;
  endsAt: string;
};

const STAFF_ROLE_SHIFT_TYPE: Record<string, string> = {
  reception: "clinic_day",
  receptionist: "clinic_day",
  nurse: "surgery_day",
  rn: "surgery_day",
  theatre: "surgery_day",
  surgeon: "surgery_day",
  doctor: "consultation_day",
  consultant: "consultation_day",
};

export function listStaffMissingStandardHours(
  staffOptions: Array<{ id: string; name: string }>,
  standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]>
): Array<{ id: string; name: string }> {
  return staffOptions.filter(
    (s) => !staffHasConfiguredStandardHours(standardHoursByStaffId[s.id])
  );
}

function shiftTypeFromStaffRole(role: string | null | undefined): string {
  const key = role?.trim().toLowerCase() ?? "";
  return STAFF_ROLE_SHIFT_TYPE[key] ?? "clinic_day";
}

function standardDayForLocalDate(
  standardHours: StaffStandardHoursDayInput[] | undefined,
  localDate: string,
  rosterCadence: RosterCadence = "weekly",
  rosterCycleAnchorDate = "2026-01-05"
): StaffStandardHoursDayInput | null {
  return resolveStandardHoursDayForLocalDate({
    standardHours,
    localDate,
    rosterCadence,
    rosterCycleAnchorDate,
  });
}

/** Prefill values when opening the shift drawer from a grid cell. */
export function buildRosterShiftDrawerDefaults(input: {
  staffId: string;
  localDate: string;
  staffRole: string | null;
  filterClinicId: string;
  standardHours: StaffStandardHoursDayInput[] | undefined;
  rosterCadence?: RosterCadence;
  rosterCycleAnchorDate?: string;
}): RosterShiftDrawerDefaults {
  const day = standardDayForLocalDate(
    input.standardHours,
    input.localDate,
    input.rosterCadence,
    input.rosterCycleAnchorDate
  );
  const clinicId = input.filterClinicId || day?.clinic_id?.trim() || "";
  const shiftType = day
    ? shiftTypeFromStandardDay(day)
    : shiftTypeFromStaffRole(input.staffRole);
  const startHm = day?.is_working_day ? (day.start_time ?? "09:00") : "09:00";
  const endHm = day?.is_working_day ? (day.end_time ?? "17:00") : "17:00";

  return {
    staffId: input.staffId,
    clinicId,
    shiftType,
    startsAt: `${input.localDate}T${startHm}`,
    endsAt: `${input.localDate}T${endHm}`,
  };
}

export function formatRosterDrawerDateLabel(localDate: string): string {
  const d = new Date(`${localDate.slice(0, 10)}T12:00:00.000Z`);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatRosterShiftDrawerTitle(input: {
  mode: "add" | "edit";
  staffName: string;
  localDate: string;
}): string {
  const dateLabel = formatRosterDrawerDateLabel(input.localDate);
  return input.mode === "edit"
    ? `Edit shift — ${input.staffName}, ${dateLabel}`
    : `Add shift — ${input.staffName}, ${dateLabel}`;
}

export type RosterShiftDrawerFormValues = {
  clinicId: string;
  shiftType: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

/** Datetime-local string for roster shift drawer inputs. */
export function toRosterShiftDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Form values for an existing shift — never derived from create defaults. */
export function buildRosterShiftFormValuesFromShift(
  shift: RosterShiftSnapshot
): RosterShiftDrawerFormValues {
  return {
    clinicId: shift.clinic_id?.trim() || "",
    shiftType: shift.shift_type,
    startsAt: toRosterShiftDatetimeLocal(shift.starts_at),
    endsAt: toRosterShiftDatetimeLocal(shift.ends_at),
    notes: shift.notes ?? "",
  };
}

export type RosterShiftDrawerEditFormInput = RosterShiftDrawerFormValues & {
  startsAtIso: string;
  endsAtIso: string;
};

export function resolveRosterShiftDrawerChangedFields(
  original: RosterShiftSnapshot,
  next: RosterShiftDrawerEditFormInput
): string[] {
  const changedFields: string[] = [];
  if (next.startsAtIso !== original.starts_at) changedFields.push("starts_at");
  if (next.endsAtIso !== original.ends_at) changedFields.push("ends_at");
  if (next.shiftType !== original.shift_type) changedFields.push("shift_type");
  const originalClinicId = original.clinic_id?.trim() || null;
  const nextClinicId = next.clinicId.trim() || null;
  if (nextClinicId !== originalClinicId) changedFields.push("clinic_id");
  const originalNotes = original.notes?.trim() || null;
  const nextNotes = next.notes.trim() || null;
  if (nextNotes !== originalNotes) changedFields.push("notes");
  return changedFields;
}

export function rosterShiftDrawerEditRequiresReason(
  original: RosterShiftSnapshot,
  next: RosterShiftDrawerEditFormInput
): boolean {
  return rosterShiftEditRequiresReason(resolveRosterShiftDrawerChangedFields(original, next));
}

export function resolveRosterShiftDrawerEditEligibility(shift: RosterShiftSnapshot | null): {
  canShowEditButton: boolean;
  canCancelShift: boolean;
} {
  if (!shift) {
    return { canShowEditButton: false, canCancelShift: false };
  }
  const editEligibility = canEditRosterShift(shift);
  const activeStatus = shift.status === "scheduled" || shift.status === "confirmed";
  return {
    canShowEditButton: editEligibility.editable,
    canCancelShift: activeStatus,
  };
}

export function formatStandardHoursDrawerTitle(staffName: string): string {
  return `${staffName} — Standard hours`;
}

export function formatStandardHoursWeeklyTotalLabel(
  days: StaffStandardHoursDayInput[] | undefined
): string {
  if (!days?.length) return "0.0 h";
  return `${(computeStandardHoursWeeklyTotal(days) / 60).toFixed(1)} h`;
}

/** Layout contract: roster page must scroll vertically; grid scrolls horizontally. */
export const ROSTER_PAGE_SCROLL_ROOT_CLASSES = "min-h-full w-full shrink-0";
export const ROSTER_GRID_SCROLL_CLASSES = "overflow-x-auto";

/** Clinic/staff-local calendar day for roster availability grid cells. */
export function rosterAvailabilityLocalDateFromIso(
  iso: string,
  staffTimezone: string | null | undefined,
  tenantTimezone: string
): string {
  const ms = parseIsoUtcMs(iso);
  if (ms == null) return iso.trim().slice(0, 10);
  const tz = normalizeCalendarTimezone(staffTimezone?.trim() || tenantTimezone);
  return calendarDateStringFromInstant(new Date(ms), tz);
}
