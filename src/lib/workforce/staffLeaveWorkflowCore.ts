/**
 * WorkforceOS — staff leave workflow (pure logic, no I/O).
 * Covers maternity leave presentation, roster exclusion, and shift conflict detection.
 */

import type { AvailabilityBlockType } from "@/src/lib/workforce-os/workforceRosteringEngine";

export type StaffLeaveBlockType = AvailabilityBlockType | "maternity_leave";

export type StaffLeaveBlockSnapshot = {
  id: string;
  block_type: StaffLeaveBlockType;
  starts_at: string;
  ends_at: string;
  status?: string | null;
  reason?: string | null;
};

export type StaffShiftSnapshot = {
  id: string;
  starts_at: string;
  ends_at: string;
  status?: string | null;
};

export type StaffLeavePeriodKind = "maternity_leave" | "leave" | "sick_leave" | "unavailable";

export type StaffActiveLeavePeriod = {
  kind: StaffLeavePeriodKind;
  blockId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type StaffLeavePresentation = {
  isOnLeave: boolean;
  isMaternityLeave: boolean;
  primaryStatusLabel: string | null;
  rosterStatusLabel: string | null;
  hideNextShift: boolean;
  suppressTrainingBlockers: boolean;
  suppressStandardHoursRequirement: boolean;
  futureShiftConflictCount: number;
};

export type MaternityLeaveConfirmationInput = {
  staffName: string;
  startDate: string;
  expectedReturnDate: string;
  keepLoginAccess: boolean;
  pauseRosterEligibility: boolean;
  pauseStandardHours: boolean;
};

const LEAVE_BLOCK_TYPES = new Set<StaffLeaveBlockType>([
  "leave",
  "sick_leave",
  "maternity_leave",
  "unavailable",
]);

const MATERNITY_BLOCK_TYPES = new Set<StaffLeaveBlockType>(["maternity_leave"]);

function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return NaN;
  return ms;
}

function isActiveBlock(block: StaffLeaveBlockSnapshot): boolean {
  return block.status !== "cancelled";
}

export function isMaternityLeaveBlock(block: StaffLeaveBlockSnapshot): boolean {
  if (!isActiveBlock(block)) return false;
  if (MATERNITY_BLOCK_TYPES.has(block.block_type)) return true;
  const reason = String(block.reason ?? "").toLowerCase();
  return block.block_type === "leave" && reason.includes("maternity");
}

export function isLeaveBlockingBlock(block: StaffLeaveBlockSnapshot): boolean {
  return isActiveBlock(block) && LEAVE_BLOCK_TYPES.has(block.block_type);
}

export function isDateWithinLeavePeriod(
  localOrIsoDate: string,
  leave: Pick<StaffActiveLeavePeriod, "startsAt" | "endsAt">
): boolean {
  const refMs = parseIsoMs(
    localOrIsoDate.includes("T") ? localOrIsoDate : `${localOrIsoDate}T12:00:00.000Z`
  );
  const startMs = parseIsoMs(leave.startsAt);
  const endMs = parseIsoMs(leave.endsAt);
  if (!Number.isFinite(refMs) || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return false;
  }
  return refMs >= startMs && refMs <= endMs;
}

export function resolveActiveLeavePeriod(input: {
  employmentStatus: string | null | undefined;
  availabilityBlocks: readonly StaffLeaveBlockSnapshot[];
  referenceDate?: string;
}): StaffActiveLeavePeriod | null {
  const employment = String(input.employmentStatus ?? "")
    .trim()
    .toLowerCase();
  const ref = input.referenceDate ?? new Date().toISOString();
  const refMs = parseIsoMs(ref);
  if (!Number.isFinite(refMs)) return null;

  const activeBlocks = input.availabilityBlocks.filter(isLeaveBlockingBlock);
  const overlapping = activeBlocks
    .filter((block) => {
      const startMs = parseIsoMs(block.starts_at);
      const endMs = parseIsoMs(block.ends_at);
      return (
        Number.isFinite(startMs) && Number.isFinite(endMs) && refMs >= startMs && refMs <= endMs
      );
    })
    .sort((a, b) => parseIsoMs(b.starts_at) - parseIsoMs(a.starts_at));

  const maternity = overlapping.find(isMaternityLeaveBlock);
  const chosen = maternity ?? overlapping[0];

  if (chosen) {
    const kind: StaffLeavePeriodKind = isMaternityLeaveBlock(chosen)
      ? "maternity_leave"
      : chosen.block_type === "sick_leave"
        ? "sick_leave"
        : chosen.block_type === "unavailable"
          ? "unavailable"
          : "leave";

    return {
      kind,
      blockId: chosen.id,
      startsAt: chosen.starts_at,
      endsAt: chosen.ends_at,
      reason: chosen.reason ?? null,
    };
  }

  if (employment === "on_leave") {
    return {
      kind: "leave",
      blockId: "employment_on_leave",
      startsAt: ref,
      endsAt: ref,
      reason: null,
    };
  }

  return null;
}

export function formatLeaveEndDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function resolveStaffLeavePresentation(input: {
  employmentStatus: string | null | undefined;
  availabilityBlocks: readonly StaffLeaveBlockSnapshot[];
  futureShifts: readonly StaffShiftSnapshot[];
  nextShiftLabel?: string | null;
  referenceDate?: string;
}): StaffLeavePresentation {
  const leave = resolveActiveLeavePeriod({
    employmentStatus: input.employmentStatus,
    availabilityBlocks: input.availabilityBlocks,
    referenceDate: input.referenceDate,
  });

  const futureShiftConflictCount = leave
    ? findFutureShiftsDuringLeave(input.futureShifts, leave.startsAt, leave.endsAt).length
    : 0;

  if (!leave) {
    return {
      isOnLeave: false,
      isMaternityLeave: false,
      primaryStatusLabel: null,
      rosterStatusLabel: null,
      hideNextShift: false,
      suppressTrainingBlockers: false,
      suppressStandardHoursRequirement: false,
      futureShiftConflictCount: 0,
    };
  }

  const isMaternity = leave.kind === "maternity_leave";
  const untilLabel = formatLeaveEndDateLabel(leave.endsAt);
  const primaryStatusLabel = isMaternity
    ? `On maternity leave until ${untilLabel}`
    : `On leave until ${untilLabel}`;

  const nextShiftInsideLeave =
    Boolean(input.nextShiftLabel) && isDateWithinLeavePeriod(new Date().toISOString(), leave);

  return {
    isOnLeave: true,
    isMaternityLeave: isMaternity,
    primaryStatusLabel,
    rosterStatusLabel: isMaternity ? "On maternity leave" : "On leave",
    hideNextShift: nextShiftInsideLeave || leave.kind !== "leave",
    suppressTrainingBlockers: true,
    suppressStandardHoursRequirement: true,
    futureShiftConflictCount,
  };
}

export function findFutureShiftsDuringLeave(
  shifts: readonly StaffShiftSnapshot[],
  leaveStartIso: string,
  leaveEndIso: string
): StaffShiftSnapshot[] {
  const leaveStart = parseIsoMs(leaveStartIso);
  const leaveEnd = parseIsoMs(leaveEndIso);
  const nowMs = Date.now();
  if (!Number.isFinite(leaveStart) || !Number.isFinite(leaveEnd)) return [];

  return shifts.filter((shift) => {
    if (shift.status === "cancelled") return false;
    const shiftStart = parseIsoMs(shift.starts_at);
    const shiftEnd = parseIsoMs(shift.ends_at);
    if (!Number.isFinite(shiftStart) || !Number.isFinite(shiftEnd)) return false;
    if (shiftStart < nowMs) return false;
    return shiftStart < leaveEnd && shiftEnd > leaveStart;
  });
}

export function buildMaternityLeaveConfirmationSummary(input: MaternityLeaveConfirmationInput): {
  headline: string;
  preserves: string[];
  changes: string[];
  optionalNotes: string[];
} {
  const startLabel = formatLeaveEndDateLabel(input.startDate);
  const endLabel = formatLeaveEndDateLabel(input.expectedReturnDate);

  const changes: string[] = [
    `${input.staffName} will remain an active staff profile, but she will be excluded from roster generation and standard-hours requirements from ${startLabel} to ${endLabel}.`,
  ];

  if (input.pauseRosterEligibility) {
    changes.push("Roster generation will skip this staff member for the leave period.");
  }
  if (input.pauseStandardHours) {
    changes.push("Standard-hours missing alerts will not apply during the leave period.");
  }
  if (!input.keepLoginAccess) {
    changes.push("Login access will be disabled unless you re-enable it in Staff Access.");
  }

  const preserves = [
    "Historical shifts, training records, documents, and audit trail will remain unchanged.",
    "Employment profile is retained — staff is not archived, terminated, or deleted.",
  ];

  const optionalNotes: string[] = [];
  if (input.keepLoginAccess) {
    optionalNotes.push("Login access will remain active unless you disable it separately.");
  }

  return {
    headline: `Set maternity leave for ${input.staffName}`,
    preserves,
    changes,
    optionalNotes,
  };
}

export function localDateToLeaveRangeIso(
  startDate: string,
  endDate: string
): {
  startsAt: string;
  endsAt: string;
} {
  const startsAt = new Date(`${startDate}T00:00:00.000Z`).toISOString();
  const endsAt = new Date(`${endDate}T23:59:59.999Z`).toISOString();
  return { startsAt, endsAt };
}
