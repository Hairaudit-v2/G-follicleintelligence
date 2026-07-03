/**
 * WorkforceOS Roster Command Centre — pure UX helpers (no I/O).
 */

import {
  shiftTypeFromStandardDay,
  weekdayIndexFromLocalDate,
} from "@/src/lib/workforce-os/rosterGenerationCore";
import {
  computeStandardHoursWeeklyTotal,
  staffHasConfiguredStandardHours,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";
import {
  buildStaffStandardHoursEditorHref,
  buildStaffStandardHoursReturnToRosterHref,
  STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON,
} from "@/src/lib/workforce-os/staffStandardHoursRoutes";

export type RosterCellClickIntent = "open_standard_hours" | "open_cell_actions";

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
  if (!input.hasStandardHours) return "open_standard_hours";
  return "open_cell_actions";
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
  localDate: string
): StaffStandardHoursDayInput | null {
  if (!standardHours?.length) return null;
  const weekday = weekdayIndexFromLocalDate(localDate);
  return standardHours.find((d) => d.weekday === weekday) ?? null;
}

/** Prefill values when opening the shift drawer from a grid cell. */
export function buildRosterShiftDrawerDefaults(input: {
  staffId: string;
  localDate: string;
  staffRole: string | null;
  filterClinicId: string;
  standardHours: StaffStandardHoursDayInput[] | undefined;
}): RosterShiftDrawerDefaults {
  const day = standardDayForLocalDate(input.standardHours, input.localDate);
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
