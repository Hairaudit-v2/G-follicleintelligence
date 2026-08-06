/**
 * Pure staff availability filter for next-slot search.
 * Matches save-time booking precedence via roster `getStaffAvailabilityForRange`.
 */

import {
  getStaffAvailabilityForRange,
  type StaffAvailabilityBlockRecord,
} from "@/src/lib/team/roster/availability";

export function isCandidateSlotWithinStaffEffectiveAvailability(input: {
  staffId: string;
  startIso: string;
  endIso: string;
  workingHours: Record<string, unknown> | null | undefined;
  staffTimezone: string;
  availabilityBlocks: StaffAvailabilityBlockRecord[];
}): boolean {
  return getStaffAvailabilityForRange({
    staffId: input.staffId,
    startsAt: input.startIso,
    endsAt: input.endIso,
    workingHours: input.workingHours,
    staffTimezone: input.staffTimezone,
    availabilityBlocks: input.availabilityBlocks,
    shifts: [],
  }).available;
}
