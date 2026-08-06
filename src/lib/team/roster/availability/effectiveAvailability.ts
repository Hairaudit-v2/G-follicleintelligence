/**
 * Team Roster — effective availability for a UTC range (client-safe).
 *
 * Precedence for a candidate window:
 * 1. Active blocking blocks (leave / sick / unavailable / training / admin / maternity)
 * 2. Active `available_override` (allows outside the weekly template without rewriting it)
 * 3. Recurring weekly hours template (`fi_staff.working_hours`)
 *
 * Explicit roster shifts are returned for callers but are not required for `available`.
 * Bookings compose this contract in `staffSlotAvailability.server.ts`.
 */

import {
  DEFAULT_STAFF_HOURS_FALLBACK_TZ,
  isUtcRangeWithinStaffWeeklyHours,
  parseStaffWeeklyHours,
} from "@/src/lib/team/roster/availability/weeklyHours";

export type AvailabilityBlockType =
  | "unavailable"
  | "leave"
  | "sick_leave"
  | "maternity_leave"
  | "training"
  | "admin"
  | "available_override";

export type AvailabilityBlockStatus = "active" | "cancelled";

export type ShiftStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

export type StaffAvailabilityBlockRecord = {
  id: string;
  block_type: AvailabilityBlockType;
  starts_at: string;
  ends_at: string;
  status: AvailabilityBlockStatus;
  reason?: string | null;
};

export type StaffShiftRecord = {
  id: string;
  shift_type: string;
  starts_at: string;
  ends_at: string;
  status: ShiftStatus;
};

export type StaffAvailabilityRangeInput = {
  staffId: string;
  startsAt: string;
  endsAt: string;
  workingHours: Record<string, unknown> | null | undefined;
  staffTimezone?: string | null;
  availabilityBlocks: StaffAvailabilityBlockRecord[];
  shifts: StaffShiftRecord[];
};

export type StaffAvailabilityRangeResult = {
  available: boolean;
  reasons: string[];
  activeBlocks: StaffAvailabilityBlockRecord[];
  matchingShifts: StaffShiftRecord[];
};

export const BLOCKING_AVAILABILITY_BLOCK_TYPES: readonly AvailabilityBlockType[] = [
  "unavailable",
  "leave",
  "sick_leave",
  "maternity_leave",
  "training",
  "admin",
] as const;

export function parseTimeRangeMs(
  startsAt: string,
  endsAt: string
): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

export function rangesOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * Effective staff availability for `[startsAt, endsAt)`.
 * Does not load DB — callers supply working hours, blocks, and shifts.
 */
export function getStaffAvailabilityForRange(
  input: StaffAvailabilityRangeInput
): StaffAvailabilityRangeResult {
  const range = parseTimeRangeMs(input.startsAt, input.endsAt);
  const reasons: string[] = [];
  const activeBlocks = input.availabilityBlocks.filter((b) => b.status === "active");

  const overlappingBlocks = activeBlocks.filter((b) => {
    const br = parseTimeRangeMs(b.starts_at, b.ends_at);
    return br && range && rangesOverlap(range.startMs, range.endMs, br.startMs, br.endMs);
  });

  const matchingShifts = input.shifts.filter((s) => {
    if (s.status === "cancelled") return false;
    const sr = parseTimeRangeMs(s.starts_at, s.ends_at);
    return sr && range && rangesOverlap(range.startMs, range.endMs, sr.startMs, sr.endMs);
  });

  const hasOverride = overlappingBlocks.some((b) => b.block_type === "available_override");
  const blockingBlocks = overlappingBlocks.filter((b) =>
    (BLOCKING_AVAILABILITY_BLOCK_TYPES as readonly string[]).includes(b.block_type)
  );

  if (blockingBlocks.length > 0) {
    for (const b of blockingBlocks) {
      reasons.push(`Active ${b.block_type.replace(/_/g, " ")} block`);
    }
  }

  let withinWorkingHours = false;
  if (range) {
    const weekly = parseStaffWeeklyHours(input.workingHours);
    const tz = input.staffTimezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ;
    withinWorkingHours = isUtcRangeWithinStaffWeeklyHours(range.startMs, range.endMs, weekly, tz);
    if (!withinWorkingHours && !hasOverride) {
      reasons.push("Outside configured weekly working hours");
    }
  }

  return {
    available: blockingBlocks.length === 0 && (withinWorkingHours || hasOverride),
    reasons,
    activeBlocks: overlappingBlocks,
    matchingShifts,
  };
}
