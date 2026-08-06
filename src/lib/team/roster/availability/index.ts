/**
 * Public Team roster availability API — weekly template + effective UTC-range predicates.
 * Client + server safe. Bookings compose this via their own server gate.
 */

export {
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
  STAFF_WEEKDAY_KEYS,
  buildStaffBookingAvailabilityHint,
  defaultPerthClinicWeeklyHours,
  formatStaffWeeklyHoursSummary,
  isUtcRangeWithinStaffWeeklyHours,
  minutesFromHm,
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
  staffLocalMinutesFromUtcMs,
  staffWeekdayKeyFromUtcMs,
  timeZoneShortLabel,
  type StaffDayHours,
  type StaffHoursHintInput,
  type StaffWeekdayKey,
  type StaffWeeklyHoursMap,
  type StaffWorkingHoursDocument,
} from "@/src/lib/team/roster/availability/weeklyHours";

export {
  BLOCKING_AVAILABILITY_BLOCK_TYPES,
  getStaffAvailabilityForRange,
  parseTimeRangeMs,
  rangesOverlap,
  type AvailabilityBlockStatus,
  type AvailabilityBlockType,
  type ShiftStatus,
  type StaffAvailabilityBlockRecord,
  type StaffAvailabilityRangeInput,
  type StaffAvailabilityRangeResult,
  type StaffShiftRecord,
} from "@/src/lib/team/roster/availability/effectiveAvailability";
