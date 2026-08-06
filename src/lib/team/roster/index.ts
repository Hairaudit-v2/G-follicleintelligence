/**
 * Public Team roster API — identity projections + availability contracts.
 * Server loaders remain in `src/lib/workforce-os/` until a later domain move;
 * they must import from this index (and identity/server), never from `team/identity/internal`.
 *
 * Availability (weekly template + effective UTC-range): also available via
 * `@/src/lib/team/roster/availability`.
 */

export type {
  RosterStaffAttentionReason,
  RosterStaffEntry,
  RosterStaffIdentitySummary,
} from "@/src/lib/team/roster/types";

export { ROSTER_STAFF_ATTENTION_LABELS } from "@/src/lib/team/roster/types";

export { deriveRosterIdentityAttentionReasons } from "@/src/lib/team/roster/rosterIdentityAttentionReasons";

export {
  deriveRosterIdentityActionFlags,
  indexRosterMemberContextByStaffId,
  isRosterIdentityTargetUncertain,
  toRosterStaffMemberContext,
  type RosterIdentityActionFlags,
} from "@/src/lib/team/roster/rosterIdentityEligibilityBridge";

export {
  projectRosterStaffEntry,
  type RosterStaffProjectionFacts,
} from "@/src/lib/team/roster/projectRosterStaffEntry";

export {
  BLOCKING_AVAILABILITY_BLOCK_TYPES,
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
  STAFF_WEEKDAY_KEYS,
  buildStaffBookingAvailabilityHint,
  defaultPerthClinicWeeklyHours,
  formatStaffWeeklyHoursSummary,
  getStaffAvailabilityForRange,
  isUtcRangeWithinStaffWeeklyHours,
  minutesFromHm,
  parseStaffWeeklyHours,
  parseTimeRangeMs,
  rangesOverlap,
  serializeStaffWeeklyHours,
  staffLocalMinutesFromUtcMs,
  staffWeekdayKeyFromUtcMs,
  timeZoneShortLabel,
  type AvailabilityBlockStatus,
  type AvailabilityBlockType,
  type ShiftStatus,
  type StaffAvailabilityBlockRecord,
  type StaffAvailabilityExplanation,
  type StaffAvailabilityRangeInput,
  type StaffAvailabilityRangeResult,
  type StaffAvailabilitySource,
  type StaffDayHours,
  type StaffHoursHintInput,
  type StaffShiftRecord,
  type StaffWeekdayKey,
  type StaffWeeklyHoursMap,
  type StaffWorkingHoursDocument,
} from "@/src/lib/team/roster/availability";
