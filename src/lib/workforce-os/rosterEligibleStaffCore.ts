/**
 * WorkforceOS — roster-eligible staff filter (pure logic, no I/O).
 *
 * Only active, roster-eligible staff require standard hours or participate in
 * roster generation validation for a selected period.
 */

import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { DEFAULT_STAFF_HOURS_FALLBACK_TZ } from "@/src/lib/staff/staffWeeklyHours";
import { isStaffArchived } from "@/src/lib/workforce-os/hrReconciliationEligibleCore";
import {
  isOperationallyIneligible,
  parseStaffEmploymentStatus,
} from "@/src/lib/workforce-os/staffLifecycleCore";
import type { StaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleTypes";
import type { AvailabilityBlockType } from "@/src/lib/workforce-os/workforceRosteringEngine";
import {
  staffHasConfiguredStandardHours,
  type StaffStandardHoursDayInput,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

export type RosterIneligibilityReason =
  | "inactive"
  | "archived"
  | "pending_onboarding"
  | "employment_status"
  | "departed"
  | "full_period_unavailable"
  | "no_tenant_association";

export type RosterStaffLifecycleContext = {
  staffId: string;
  isActive: boolean;
  employmentStatus: StaffEmploymentStatus;
  archivedAt: string | null;
  tenantId: string | null;
};

export type RosterAvailabilityBlockContext = {
  block_type: AvailabilityBlockType;
  starts_at: string;
  ends_at: string;
  status?: string | null;
};

export type RosterStaffEligibilityInput = RosterStaffLifecycleContext & {
  periodDayDates: readonly string[];
  availabilityBlocks: readonly RosterAvailabilityBlockContext[];
  staffTimezone?: string | null;
};

export type RosterStaffEligibilitySnapshot = {
  eligible: boolean;
  reason: RosterIneligibilityReason | null;
};

const FULL_PERIOD_BLOCKING_TYPES = new Set<AvailabilityBlockType>([
  "leave",
  "sick_leave",
  "maternity_leave",
  "unavailable",
]);

export const ROSTER_INELIGIBLE_EMPLOYMENT_STATUSES: ReadonlySet<StaffEmploymentStatus> = new Set([
  "inactive",
  "on_leave",
  "pending_onboarding",
  "suspended",
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "merged",
]);

function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return ms;
}

function wallTimeToUtcIso(localDate: string, hm: string, tz: string): string {
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) throw new Error(`Invalid time: ${hm}`);

  const guess = new Date(`${localDate}T${hm}:00.000Z`);
  const offsetMin = localOffsetMinutesAt(guess, tz);
  const utcMs = guess.getTime() - offsetMin * 60_000;
  return new Date(utcMs).toISOString();
}

function localOffsetMinutesAt(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(instant).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  const offsetRaw = parts.timeZoneName ?? "GMT";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetRaw);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const oh = Number(match[2]);
  const om = Number(match[3] ?? 0);
  return sign * (oh * 60 + om);
}

function isLocalDateFullyBlocked(
  localDate: string,
  blocks: readonly RosterAvailabilityBlockContext[],
  tz: string
): boolean {
  const normalizedTz = normalizeCalendarTimezone(tz);
  const dayStartMs = parseIsoMs(wallTimeToUtcIso(localDate, "00:00", normalizedTz));
  const dayEndMs = parseIsoMs(wallTimeToUtcIso(localDate, "23:59", normalizedTz));

  for (const block of blocks) {
    if (block.status === "cancelled") continue;
    if (!FULL_PERIOD_BLOCKING_TYPES.has(block.block_type)) continue;
    const blockStart = parseIsoMs(block.starts_at);
    const blockEnd = parseIsoMs(block.ends_at);
    if (blockStart <= dayStartMs && blockEnd >= dayEndMs) return true;
  }
  return false;
}

export function isStaffFullyUnavailableForPeriod(input: {
  periodDayDates: readonly string[];
  availabilityBlocks: readonly RosterAvailabilityBlockContext[];
  staffTimezone?: string | null;
}): boolean {
  if (!input.periodDayDates.length) return false;
  const tz = input.staffTimezone?.trim() || DEFAULT_STAFF_HOURS_FALLBACK_TZ;
  return input.periodDayDates.every((localDate) =>
    isLocalDateFullyBlocked(localDate, input.availabilityBlocks, tz)
  );
}

export function evaluateRosterStaffLifecycleEligibility(
  input: RosterStaffLifecycleContext
): RosterStaffEligibilitySnapshot {
  if (!input.tenantId?.trim()) {
    return { eligible: false, reason: "no_tenant_association" };
  }
  if (isStaffArchived({ archived_at: input.archivedAt })) {
    return { eligible: false, reason: "archived" };
  }
  if (!input.isActive) {
    return { eligible: false, reason: "inactive" };
  }
  if (input.employmentStatus === "pending_onboarding") {
    return { eligible: false, reason: "pending_onboarding" };
  }
  if (isOperationallyIneligible(input.employmentStatus)) {
    return { eligible: false, reason: "departed" };
  }
  if (ROSTER_INELIGIBLE_EMPLOYMENT_STATUSES.has(input.employmentStatus)) {
    return { eligible: false, reason: "employment_status" };
  }
  if (input.employmentStatus !== "active") {
    return { eligible: false, reason: "employment_status" };
  }
  return { eligible: true, reason: null };
}

export function evaluateRosterStaffEligibility(
  input: RosterStaffEligibilityInput
): RosterStaffEligibilitySnapshot {
  const lifecycle = evaluateRosterStaffLifecycleEligibility(input);
  if (!lifecycle.eligible) return lifecycle;

  if (
    isStaffFullyUnavailableForPeriod({
      periodDayDates: input.periodDayDates,
      availabilityBlocks: input.availabilityBlocks,
      staffTimezone: input.staffTimezone,
    })
  ) {
    return { eligible: false, reason: "full_period_unavailable" };
  }

  return { eligible: true, reason: null };
}

export function rosterIneligibilityReasonLabel(reason: RosterIneligibilityReason): string {
  switch (reason) {
    case "inactive":
      return "Inactive";
    case "archived":
      return "Archived";
    case "pending_onboarding":
      return "Pending onboarding";
    case "employment_status":
      return "On leave or unavailable";
    case "departed":
      return "Offboarded";
    case "full_period_unavailable":
      return "On leave for this period";
    case "no_tenant_association":
      return "Not linked to tenant";
    default:
      return "Not rostered";
  }
}

export function resolveRosterEligibleStaffIds(
  staffIds: readonly string[],
  eligibilityByStaffId: ReadonlyMap<string, RosterStaffEligibilitySnapshot>
): string[] {
  return staffIds.filter((staffId) => eligibilityByStaffId.get(staffId)?.eligible === true);
}

export function listStaffMissingStandardHoursForRoster(
  staffOptions: Array<{ id: string; name: string }>,
  standardHoursByStaffId: Record<string, StaffStandardHoursDayInput[]>,
  eligibleStaffIds: ReadonlySet<string> | readonly string[]
): Array<{ id: string; name: string }> {
  const eligibleSet = new Set(eligibleStaffIds);
  return staffOptions.filter(
    (staff) =>
      eligibleSet.has(staff.id) &&
      !staffHasConfiguredStandardHours(standardHoursByStaffId[staff.id])
  );
}

export function resolveEmploymentStatusForRosterStaff(input: {
  isActive: boolean;
  employmentStatus: unknown;
}): StaffEmploymentStatus {
  if (input.employmentStatus == null || String(input.employmentStatus).trim() === "") {
    return input.isActive ? "active" : "inactive";
  }
  return parseStaffEmploymentStatus(input.employmentStatus);
}
