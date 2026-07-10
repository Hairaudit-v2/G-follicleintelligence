/**
 * WorkforceOS Roster Command Centre — pure UX helpers (no I/O).
 */

import {
  calendarDateStringFromInstant,
  fromDatetimeLocalValueInTimezone,
  normalizeCalendarTimezone,
  parseIsoUtcMs,
  toDatetimeLocalValueInTimezone,
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
  ROSTER_MANAGE_DENIED_REASON,
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

export type RosterDrawerStaffOption = {
  id: string;
  name: string;
  role: string | null;
};

export const ROSTER_DRAWER_STAFF_UNAVAILABLE_MESSAGE =
  "Could not open the roster drawer for this staff member. Refresh the page and try again.";

/** Single source for roster manage-deny copy (never allow blank deny messages). */
export function resolveRosterManageDeniedMessage(
  manageDeniedReason?: string | null
): string {
  const trimmed = manageDeniedReason?.trim();
  return trimmed || ROSTER_MANAGE_DENIED_REASON;
}

export type RosterDayAwayKind = "sick_leave" | "leave" | "unavailable";

const ROSTER_DAY_AWAY_LABELS: Record<RosterDayAwayKind, string> = {
  sick_leave: "Sick leave",
  leave: "Personal leave",
  unavailable: "Unavailable",
};

export function rosterDayAwayReasonLabel(kind: RosterDayAwayKind): string {
  return ROSTER_DAY_AWAY_LABELS[kind];
}

/** Cancellation reason applied when marking a full day away. */
export function rosterDayAwayShiftCancellationReason(
  kind: RosterDayAwayKind
): "staff_sick" | "manual_adjustment" {
  return kind === "sick_leave" ? "staff_sick" : "manual_adjustment";
}

export type RosterCancellableDayShift = {
  id: string;
  status: string;
};

/**
 * Shifts cancelled when marking a day away — union of day list + selected shift,
 * de-duplicated, only scheduled/confirmed.
 */
export function collectCancellableRosterDayShifts(input: {
  dayShifts: readonly RosterCancellableDayShift[];
  selectedShift?: RosterCancellableDayShift | null;
}): RosterCancellableDayShift[] {
  const isActive = (status: string) => status === "scheduled" || status === "confirmed";
  const byId = new Map<string, RosterCancellableDayShift>();

  for (const shift of input.dayShifts) {
    if (isActive(shift.status)) byId.set(shift.id, shift);
  }
  if (input.selectedShift && isActive(input.selectedShift.status)) {
    byId.set(input.selectedShift.id, input.selectedShift);
  }

  return [...byId.values()];
}

export type RosterPeriodShiftLike = RosterCancellableDayShift & {
  staff_id: string;
  localDate?: string;
  starts_at: string;
};

/** Active shifts for one staff across a set of local calendar dates (grid period). */
export function collectCancellableStaffShiftsInPeriod(input: {
  shifts: readonly RosterPeriodShiftLike[];
  staffId: string;
  localDates: readonly string[];
}): RosterPeriodShiftLike[] {
  const dateSet = new Set(input.localDates.map((d) => d.slice(0, 10)));
  return input.shifts.filter((shift) => {
    if (shift.staff_id !== input.staffId) return false;
    if (shift.status !== "scheduled" && shift.status !== "confirmed") return false;
    const local = (shift.localDate ?? shift.starts_at.slice(0, 10)).slice(0, 10);
    return dateSet.has(local);
  });
}

/** Full-period leave window (first day 00:00 → last day 23:59 local). */
export function buildRosterPeriodAbsenceLocalWindow(localDates: readonly string[]): {
  startsAtLocal: string;
  endsAtLocal: string;
} | null {
  const sorted = [...localDates].map((d) => d.slice(0, 10)).filter(Boolean).sort();
  if (sorted.length === 0) return null;
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return {
    startsAtLocal: `${first}T00:00`,
    endsAtLocal: `${last}T23:59`,
  };
}

/** Quick-cancel reasons shown on the chip action (subset of drawer reasons). */
export const ROSTER_QUICK_CANCEL_REASONS = [
  "staff_sick",
  "created_in_error",
  "clinic_closed",
  "manual_adjustment",
  "other",
] as const;

export type RosterQuickCancelReason = (typeof ROSTER_QUICK_CANCEL_REASONS)[number];

/** Resolve staff context for the shift drawer — never rely on staffOptions alone. */
export function resolveRosterDrawerStaffContext(input: {
  drawer: RosterCommandCentreDrawerState;
  staffOptions: readonly RosterDrawerStaffOption[];
  rosterGridStaffOptions?: readonly RosterDrawerStaffOption[];
  selectedShift?: { staff_id: string; staffName?: string | null } | null;
}): RosterDrawerStaffOption | null {
  const staffMemberId = resolveRosterDrawerStaffMemberId(input.drawer)?.trim();
  if (!staffMemberId) return null;

  const findStaff = (options: readonly RosterDrawerStaffOption[]) =>
    options.find((staff) => staff.id === staffMemberId) ?? null;

  const fromStaffOptions = findStaff(input.staffOptions);
  if (fromStaffOptions) return fromStaffOptions;

  const fromGrid = input.rosterGridStaffOptions
    ? findStaff(input.rosterGridStaffOptions)
    : null;
  if (fromGrid) return fromGrid;

  if (input.selectedShift?.staff_id === staffMemberId) {
    return {
      id: staffMemberId,
      name: input.selectedShift.staffName?.trim() || "Staff",
      role: null,
    };
  }

  return null;
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

export function resolveRosterEmptyCellLabel(_input: {
  hasStandardHours: boolean;
}): RosterEmptyCellLabel {
  void _input.hasStandardHours;
  return "add_shift";
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
      message: resolveRosterManageDeniedMessage(input.manageDeniedReason),
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

/**
 * Normalise time strings for `<input type="datetime-local">` (must be HH:mm).
 * DB / standard-hours values may arrive as `8:30`, `08:30:00`, or `08:30:00.000`.
 */
export function normaliseDatetimeLocalHm(
  raw: string | null | undefined,
  fallback = "09:00"
): string {
  const t = (raw ?? "").trim();
  const match = t.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return fallback;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Full calendar day window in datetime-local form for leave / sick blocks. */
export function buildRosterFullDayAbsenceLocalWindow(localDate: string): {
  startsAtLocal: string;
  endsAtLocal: string;
} {
  const d = localDate.slice(0, 10);
  return {
    startsAtLocal: `${d}T00:00`,
    endsAtLocal: `${d}T23:59`,
  };
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
  const startHm = normaliseDatetimeLocalHm(
    day?.is_working_day ? day.start_time : null,
    "09:00"
  );
  const endHm = normaliseDatetimeLocalHm(
    day?.is_working_day ? day.end_time : null,
    "17:00"
  );
  const date = input.localDate.slice(0, 10);

  return {
    staffId: input.staffId,
    clinicId,
    shiftType,
    startsAt: `${date}T${startHm}`,
    endsAt: `${date}T${endHm}`,
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

export function resolveRosterShiftStaffTimezone(
  staffTimezone: string | null | undefined,
  tenantTimezone: string
): string {
  return normalizeCalendarTimezone(staffTimezone?.trim() || tenantTimezone);
}

/** Datetime-local string for roster shift drawer inputs in staff/tenant timezone. */
export function toRosterShiftDatetimeLocal(
  iso: string,
  staffTimezone?: string | null,
  tenantTimezone?: string
): string {
  if (staffTimezone?.trim() || tenantTimezone?.trim()) {
    return toDatetimeLocalValueInTimezone(
      iso,
      resolveRosterShiftStaffTimezone(staffTimezone, tenantTimezone ?? "UTC")
    );
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ROSTER_SHIFT_START_END_REQUIRED_MESSAGE =
  "Start and end times are required.";

export const ROSTER_SHIFT_INVALID_TIME_RANGE_MESSAGE =
  "Shift end must be after start.";

/** Convert drawer datetime-local values to UTC ISO using staff/tenant timezone. */
export function rosterShiftDatetimeLocalToUtcIso(input: {
  startsAtLocal: string;
  endsAtLocal: string;
  staffTimezone?: string | null;
  tenantTimezone: string;
}): { startsAt: string; endsAt: string } | { error: string } {
  const tz = resolveRosterShiftStaffTimezone(input.staffTimezone, input.tenantTimezone);
  const startsAt = fromDatetimeLocalValueInTimezone(input.startsAtLocal.trim(), tz);
  const endsAt = fromDatetimeLocalValueInTimezone(input.endsAtLocal.trim(), tz);
  if (!startsAt || !endsAt) {
    return { error: ROSTER_SHIFT_START_END_REQUIRED_MESSAGE };
  }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    return { error: ROSTER_SHIFT_INVALID_TIME_RANGE_MESSAGE };
  }
  return { startsAt, endsAt };
}

/** Match a roster grid shift to a staff/day cell using timezone-aware local date. */
export function shiftMatchesRosterCellDate(
  shift: { staff_id: string; starts_at: string; localDate?: string },
  staffId: string,
  localDate: string
): boolean {
  if (shift.staff_id !== staffId) return false;
  const cellDate = localDate.slice(0, 10);
  if (shift.localDate) return shift.localDate.slice(0, 10) === cellDate;
  return shift.starts_at.slice(0, 10) === cellDate;
}

/** Form values for an existing shift — never derived from create defaults. */
export function buildRosterShiftFormValuesFromShift(
  shift: RosterShiftSnapshot,
  staffTimezone?: string | null,
  tenantTimezone?: string
): RosterShiftDrawerFormValues {
  return {
    clinicId: shift.clinic_id?.trim() || "",
    shiftType: shift.shift_type,
    startsAt: toRosterShiftDatetimeLocal(shift.starts_at, staffTimezone, tenantTimezone),
    endsAt: toRosterShiftDatetimeLocal(shift.ends_at, staffTimezone, tenantTimezone),
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
  openInEditMode: boolean;
} {
  if (!shift) {
    return { canShowEditButton: false, canCancelShift: false, openInEditMode: false };
  }
  const editEligibility = canEditRosterShift(shift);
  const activeStatus = shift.status === "scheduled" || shift.status === "confirmed";
  const generated =
    shift.shift_source === "standard_hours" || shift.shift_source === "copy_week";
  return {
    canShowEditButton: editEligibility.editable,
    canCancelShift: activeStatus,
    openInEditMode: editEligibility.editable && activeStatus && generated,
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
