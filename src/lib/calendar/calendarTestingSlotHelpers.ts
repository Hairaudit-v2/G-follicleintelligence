/**
 * Pure helpers for ClinicOS calendar QA slot math (Stage Calendar 2C).
 */

import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  normalizeCalendarTimezone,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { StaffWeeklyHoursMap } from "@/src/lib/staff/staffWeeklyHours";
import { staffWeekdayKeyFromUtcMs } from "@/src/lib/staff/staffWeeklyHours";

/** Next local calendar day (from `fromMs` in `staffTz`) where weekly config has enabled hours with start+end. */
export function nextStaffWorkingLocalDayYmd(
  staffTz: string,
  weekly: StaffWeeklyHoursMap,
  fromMs: number
): string | null {
  const tz = normalizeCalendarTimezone(staffTz);
  let ymd = calendarDateStringFromInstant(new Date(fromMs), tz);
  for (let i = 0; i < 21; i++) {
    const mid = zonedMidnightUtcMs(ymd, tz);
    if (mid == null) return null;
    const anchor = mid + 12 * 3_600_000;
    const wk = staffWeekdayKeyFromUtcMs(anchor, tz);
    const day = weekly[wk];
    if (day?.enabled !== false && day?.start && day?.end) return ymd;
    ymd = addDaysToCalendarDate(ymd, 1, tz);
  }
  return null;
}
