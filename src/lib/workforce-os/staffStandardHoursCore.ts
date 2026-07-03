/**
 * WorkforceOS — staff standard hours (pure logic, no I/O).
 * Weekday index: 0=Monday … 6=Sunday (ISO weekday minus 1).
 */

import {
  minutesFromHm,
  STAFF_WEEKDAY_KEYS,
  type StaffWeekdayKey,
  type StaffWeeklyHoursMap,
} from "@/src/lib/staff/staffWeeklyHours";

export const STANDARD_HOURS_WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type StandardHoursStatus = "active" | "archived";

export type StandardHoursShiftSource = "manual" | "standard_hours" | "copy_week";

export type StaffStandardHoursDayInput = {
  weekday: number;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  break_minutes?: number | null;
  clinic_id?: string | null;
  shift_label?: string | null;
  role_code?: string | null;
};

export type StaffStandardHoursRow = StaffStandardHoursDayInput & {
  id: string;
  tenant_id: string;
  staff_id: string;
  effective_from: string;
  effective_to: string | null;
  status: StandardHoursStatus;
};

export type StandardHoursTemplateId =
  | "five_eight"
  | "four_ten"
  | "surgery_early"
  | "reception_standard"
  | "custom";

export type StandardHoursWarningCode =
  | "zero_weekly_hours"
  | "end_before_start"
  | "shift_exceeds_threshold"
  | "overlapping_windows";

export type StandardHoursWarning = {
  code: StandardHoursWarningCode;
  message: string;
  weekday?: number;
};

export type StandardHoursValidationResult = {
  valid: boolean;
  weeklyHours: number;
  warnings: StandardHoursWarning[];
};

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_SHIFT_MINUTES = 12 * 60;

export const STANDARD_HOURS_TEMPLATE_LABELS: Record<StandardHoursTemplateId, string> = {
  five_eight: "5 × 8-hour days",
  four_ten: "4 × 10-hour days",
  surgery_early: "Surgery team early shift",
  reception_standard: "Reception standard week",
  custom: "Custom",
};

export function weekdayToStaffKey(weekday: number): StaffWeekdayKey {
  const key = STAFF_WEEKDAY_KEYS[weekday];
  if (!key) throw new RangeError(`Invalid weekday index: ${weekday}`);
  return key;
}

export function staffKeyToWeekday(key: StaffWeekdayKey): number {
  return STAFF_WEEKDAY_KEYS.indexOf(key);
}

function parseTimeHm(raw: string | null | undefined): string | null {
  const s = raw?.trim() ?? "";
  return HM_RE.test(s) ? s : null;
}

function dayWorkingMinutes(day: StaffStandardHoursDayInput): number {
  if (!day.is_working_day) return 0;
  const start = parseTimeHm(day.start_time);
  const end = parseTimeHm(day.end_time);
  if (!start || !end) return 0;
  const sm = minutesFromHm(start);
  const em = minutesFromHm(end);
  if (sm == null || em == null || em <= sm) return 0;
  const breakM = Math.max(0, day.break_minutes ?? 0);
  return Math.max(0, em - sm - breakM);
}

/** Sum net working minutes across the week pattern. */
export function computeStandardHoursWeeklyTotal(days: StaffStandardHoursDayInput[]): number {
  let total = 0;
  for (const day of days) total += dayWorkingMinutes(day);
  return total;
}

/** Format weekly total as decimal hours (one decimal place). */
export function formatStandardHoursWeeklyTotal(days: StaffStandardHoursDayInput[]): string {
  const mins = computeStandardHoursWeeklyTotal(days);
  return (mins / 60).toFixed(1);
}

export function validateStandardHoursPattern(
  days: StaffStandardHoursDayInput[]
): StandardHoursValidationResult {
  const warnings: StandardHoursWarning[] = [];
  const byWeekday = new Map<number, StaffStandardHoursDayInput>();

  for (const day of days) {
    if (day.weekday < 0 || day.weekday > 6) {
      warnings.push({
        code: "overlapping_windows",
        message: `Invalid weekday index ${day.weekday}.`,
      });
      continue;
    }
    if (byWeekday.has(day.weekday)) {
      warnings.push({
        code: "overlapping_windows",
        message: `Duplicate standard hours for ${STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]}.`,
        weekday: day.weekday,
      });
    }
    byWeekday.set(day.weekday, day);

    if (!day.is_working_day) continue;

    const start = parseTimeHm(day.start_time);
    const end = parseTimeHm(day.end_time);
    if (!start || !end) {
      warnings.push({
        code: "end_before_start",
        message: `${STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]}: start and end times are required for working days.`,
        weekday: day.weekday,
      });
      continue;
    }
    const sm = minutesFromHm(start);
    const em = minutesFromHm(end);
    if (sm == null || em == null || em <= sm) {
      warnings.push({
        code: "end_before_start",
        message: `${STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]}: end time must be after start time.`,
        weekday: day.weekday,
      });
      continue;
    }
    const net = em - sm - Math.max(0, day.break_minutes ?? 0);
    if (net > MAX_SHIFT_MINUTES) {
      warnings.push({
        code: "shift_exceeds_threshold",
        message: `${STANDARD_HOURS_WEEKDAY_LABELS[day.weekday]}: shift exceeds ${MAX_SHIFT_MINUTES / 60}-hour safe threshold.`,
        weekday: day.weekday,
      });
    }
  }

  const weeklyHours = computeStandardHoursWeeklyTotal(days);
  if (weeklyHours === 0) {
    warnings.push({
      code: "zero_weekly_hours",
      message: "Weekly hours are zero — at least one working day is required.",
    });
  }

  const blocking = warnings.some((w) =>
    ["end_before_start", "overlapping_windows", "zero_weekly_hours"].includes(w.code)
  );

  return { valid: !blocking, weeklyHours, warnings };
}

export function emptyStandardHoursWeek(): StaffStandardHoursDayInput[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    is_working_day: false,
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 0,
    clinic_id: null,
    shift_label: null,
    role_code: null,
  }));
}

function workingDay(
  weekday: number,
  start: string,
  end: string,
  breakMinutes = 0,
  extras: Partial<StaffStandardHoursDayInput> = {}
): StaffStandardHoursDayInput {
  return {
    weekday,
    is_working_day: true,
    start_time: start,
    end_time: end,
    break_minutes: breakMinutes,
    clinic_id: null,
    shift_label: null,
    role_code: null,
    ...extras,
  };
}

function rdoDay(weekday: number): StaffStandardHoursDayInput {
  return {
    weekday,
    is_working_day: false,
    start_time: null,
    end_time: null,
    break_minutes: 0,
    clinic_id: null,
    shift_label: "RDO",
    role_code: null,
  };
}

/** Apply a quick template to the 7-day pattern. */
export function applyStandardHoursTemplate(
  templateId: StandardHoursTemplateId
): StaffStandardHoursDayInput[] {
  switch (templateId) {
    case "five_eight":
      return [
        workingDay(0, "09:00", "17:00"),
        workingDay(1, "09:00", "17:00"),
        workingDay(2, "09:00", "17:00"),
        workingDay(3, "09:00", "17:00"),
        workingDay(4, "09:00", "17:00"),
        rdoDay(5),
        rdoDay(6),
      ];
    case "four_ten":
      return [
        workingDay(0, "07:30", "17:30", 0, { shift_label: "10-hour shift" }),
        workingDay(1, "07:30", "17:30", 0, { shift_label: "10-hour shift" }),
        rdoDay(2),
        workingDay(3, "07:30", "17:30", 0, { shift_label: "10-hour shift" }),
        workingDay(4, "07:30", "17:30", 0, { shift_label: "10-hour shift" }),
        rdoDay(5),
        rdoDay(6),
      ];
    case "surgery_early":
      return [
        workingDay(0, "06:30", "15:30", 30, {
          shift_label: "Surgery early",
          role_code: "theatre",
        }),
        workingDay(1, "06:30", "15:30", 30, {
          shift_label: "Surgery early",
          role_code: "theatre",
        }),
        workingDay(2, "06:30", "15:30", 30, {
          shift_label: "Surgery early",
          role_code: "theatre",
        }),
        workingDay(3, "06:30", "15:30", 30, {
          shift_label: "Surgery early",
          role_code: "theatre",
        }),
        workingDay(4, "06:30", "15:30", 30, {
          shift_label: "Surgery early",
          role_code: "theatre",
        }),
        rdoDay(5),
        rdoDay(6),
      ];
    case "reception_standard":
      return [
        workingDay(0, "08:30", "17:00", 30, { role_code: "reception" }),
        workingDay(1, "08:30", "17:00", 30, { role_code: "reception" }),
        workingDay(2, "08:30", "17:00", 30, { role_code: "reception" }),
        workingDay(3, "08:30", "17:00", 30, { role_code: "reception" }),
        workingDay(4, "08:30", "17:00", 30, { role_code: "reception" }),
        rdoDay(5),
        rdoDay(6),
      ];
    case "custom":
    default:
      return emptyStandardHoursWeek();
  }
}

/** Convert normalized standard hours to legacy `fi_staff.working_hours` JSON for engine compatibility. */
export function standardHoursToWeeklyHoursMap(
  days: StaffStandardHoursDayInput[]
): StaffWeeklyHoursMap {
  const weekly: StaffWeeklyHoursMap = {};
  for (const day of days) {
    const key = weekdayToStaffKey(day.weekday);
    if (!day.is_working_day) {
      weekly[key] = { enabled: false };
      continue;
    }
    const start = parseTimeHm(day.start_time);
    const end = parseTimeHm(day.end_time);
    if (start && end) weekly[key] = { enabled: true, start, end };
  }
  return weekly;
}

/** Map legacy weekly hours JSON into standard-hours day inputs. */
export function weeklyHoursMapToStandardHours(
  weekly: StaffWeeklyHoursMap
): StaffStandardHoursDayInput[] {
  return STAFF_WEEKDAY_KEYS.map((key, index) => {
    const day = weekly[key];
    const enabled = day?.enabled !== false && Boolean(day?.start?.trim() && day?.end?.trim());
    return {
      weekday: index,
      is_working_day: enabled,
      start_time: enabled ? (day?.start?.trim() ?? "09:00") : null,
      end_time: enabled ? (day?.end?.trim() ?? "17:00") : null,
      break_minutes: 0,
      clinic_id: null,
      shift_label: enabled ? null : "RDO",
      role_code: null,
    };
  });
}

/** ISO date (YYYY-MM-DD) for weekday index within a week starting Monday. */
export function isoDateForWeekday(weekStartIsoDate: string, weekday: number): string {
  const base = new Date(`${weekStartIsoDate}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) throw new Error("Invalid week start date.");
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + weekday);
  return d.toISOString().slice(0, 10);
}

/** Monday ISO date for the week containing `refDateIso`. */
export function mondayOfWeekIso(refDateIso: string): string {
  const d = new Date(`${refDateIso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid reference date.");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** List Monday–Sunday ISO dates for the week starting `weekStartIsoDate`. */
export function weekDayIsoDates(weekStartIsoDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => isoDateForWeekday(weekStartIsoDate, i));
}

const STANDARD_HOURS_WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** True when the staff member has at least one working day with net hours. */
export function staffHasConfiguredStandardHours(
  days: StaffStandardHoursDayInput[] | undefined
): boolean {
  if (!days?.length) return false;
  return computeStandardHoursWeeklyTotal(days) > 0;
}

/** Human-readable one-line summary for roster staff rows. */
export function formatStandardHoursSummary(
  days: StaffStandardHoursDayInput[] | undefined
): string {
  if (!staffHasConfiguredStandardHours(days)) return "No standard hours set";

  const working = days!.filter((d) => d.is_working_day);
  const minsPerDay = working.map((d) => dayWorkingMinutes(d));
  const uniformMins = minsPerDay.length > 0 && minsPerDay.every((m) => m === minsPerDay[0]);
  const hoursLabel = uniformMins
    ? `${Math.round(minsPerDay[0]! / 60)}h`
    : `${(minsPerDay.reduce((a, b) => a + b, 0) / working.length / 60).toFixed(1)}h avg`;
  const dayLabels = working.map((d) => STANDARD_HOURS_WEEKDAY_SHORT[d.weekday]).join(" ");
  const anchor = working[0];
  const allSameTimes = working.every(
    (d) => d.start_time === anchor?.start_time && d.end_time === anchor?.end_time
  );
  const timeRange =
    allSameTimes && anchor?.start_time && anchor?.end_time
      ? `${anchor.start_time}–${anchor.end_time}`
      : null;

  return timeRange
    ? `${working.length} × ${hoursLabel} · ${dayLabels} · ${timeRange}`
    : `${working.length} × ${hoursLabel} · ${dayLabels}`;
}

export function formatHmToDisplay(hm: string | null): string {
  if (!hm) return "—";
  const m = HM_RE.exec(hm.trim());
  if (!m) return hm;
  const h = Number(m[1]);
  const min = m[2];
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === "00" ? `${h12}${suffix}` : `${h12}:${min}${suffix}`;
}
