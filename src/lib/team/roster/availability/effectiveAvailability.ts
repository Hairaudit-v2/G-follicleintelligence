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

/** Why the person is available or unavailable for the requested window. */
export type StaffAvailabilitySource =
  | "weekly_hours"
  | "available_override"
  | "leave"
  | "sick_leave"
  | "maternity_leave"
  | "unavailable"
  | "training"
  | "admin"
  | "outside_weekly_hours"
  | "invalid_range";

export type StaffAvailabilityExplanation = {
  available: boolean;
  source: StaffAvailabilitySource;
  reason: string;
  /** Present when availability comes from `available_override`. */
  overrideType: "available_override" | null;
  /** Blocking / override row id when safe to expose to managers. */
  blockingRecordId: string | null;
  effectiveStart: string | null;
  effectiveEnd: string | null;
};

export type StaffAvailabilityRangeResult = {
  available: boolean;
  reasons: string[];
  activeBlocks: StaffAvailabilityBlockRecord[];
  matchingShifts: StaffShiftRecord[];
  explanation: StaffAvailabilityExplanation;
};

export const BLOCKING_AVAILABILITY_BLOCK_TYPES: readonly AvailabilityBlockType[] = [
  "unavailable",
  "leave",
  "sick_leave",
  "maternity_leave",
  "training",
  "admin",
] as const;

const BLOCK_SOURCE_LABEL: Record<
  Exclude<AvailabilityBlockType, "available_override">,
  string
> = {
  unavailable: "Unavailable / manual block",
  leave: "Leave",
  sick_leave: "Sick leave",
  maternity_leave: "Maternity leave",
  training: "Training",
  admin: "Admin",
};

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

function humanBlockLabel(blockType: AvailabilityBlockType): string {
  if (blockType === "available_override") return "Temporary available override";
  return BLOCK_SOURCE_LABEL[blockType] ?? blockType.replace(/_/g, " ");
}

function buildExplanation(input: {
  available: boolean;
  startsAt: string;
  endsAt: string;
  rangeValid: boolean;
  blockingBlocks: StaffAvailabilityBlockRecord[];
  overrideBlock: StaffAvailabilityBlockRecord | null;
  withinWorkingHours: boolean;
}): StaffAvailabilityExplanation {
  const { startsAt, endsAt } = input;
  if (!input.rangeValid) {
    return {
      available: false,
      source: "invalid_range",
      reason: "Invalid availability window",
      overrideType: null,
      blockingRecordId: null,
      effectiveStart: null,
      effectiveEnd: null,
    };
  }

  if (input.blockingBlocks.length > 0) {
    const primary = input.blockingBlocks[0]!;
    const label = humanBlockLabel(primary.block_type);
    const detail = primary.reason?.trim();
    return {
      available: false,
      source: primary.block_type as StaffAvailabilitySource,
      reason: detail ? `${label}: ${detail}` : label,
      overrideType: null,
      blockingRecordId: primary.id?.trim() || null,
      effectiveStart: primary.starts_at,
      effectiveEnd: primary.ends_at,
    };
  }

  if (input.available && input.overrideBlock && !input.withinWorkingHours) {
    const detail = input.overrideBlock.reason?.trim();
    return {
      available: true,
      source: "available_override",
      reason: detail
        ? `Temporary available override: ${detail}`
        : "Temporary available override",
      overrideType: "available_override",
      blockingRecordId: input.overrideBlock.id?.trim() || null,
      effectiveStart: input.overrideBlock.starts_at,
      effectiveEnd: input.overrideBlock.ends_at,
    };
  }

  if (input.available && input.withinWorkingHours) {
    return {
      available: true,
      source: "weekly_hours",
      reason: "Normal weekly hours",
      overrideType: input.overrideBlock ? "available_override" : null,
      blockingRecordId: input.overrideBlock?.id?.trim() || null,
      effectiveStart: startsAt,
      effectiveEnd: endsAt,
    };
  }

  return {
    available: false,
    source: "outside_weekly_hours",
    reason: "Outside normal weekly hours",
    overrideType: null,
    blockingRecordId: null,
    effectiveStart: startsAt,
    effectiveEnd: endsAt,
  };
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

  const overrideBlock =
    overlappingBlocks.find((b) => b.block_type === "available_override") ?? null;
  const hasOverride = Boolean(overrideBlock);
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

  const available = Boolean(range) && blockingBlocks.length === 0 && (withinWorkingHours || hasOverride);

  const explanation = buildExplanation({
    available,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    rangeValid: Boolean(range),
    blockingBlocks,
    overrideBlock,
    withinWorkingHours,
  });

  return {
    available,
    reasons,
    activeBlocks: overlappingBlocks,
    matchingShifts,
    explanation,
  };
}
