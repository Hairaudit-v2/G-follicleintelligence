/**
 * WorkforceOS — roster generation from standard hours (pure logic, no I/O).
 */

import { normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { DEFAULT_STAFF_HOURS_FALLBACK_TZ } from "@/src/lib/staff/staffWeeklyHours";
import type { RosterCadence } from "@/src/lib/workforce/rosterCadencePolicyCore";
import { resolveFortnightCycleWeek } from "@/src/lib/workforce/rosterCadencePolicyCore";
import type { AvailabilityBlockType } from "@/src/lib/workforce-os/workforceRosteringEngine";
import {
  normaliseCycleWeek,
  type StaffStandardHoursDayInput,
  type StandardHoursShiftSource,
} from "@/src/lib/workforce-os/staffStandardHoursCore";

export type ExistingShiftForGeneration = {
  id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  shift_source?: StandardHoursShiftSource | null;
  status?: string;
};

export type AvailabilityBlockForGeneration = {
  block_type: AvailabilityBlockType;
  starts_at: string;
  ends_at: string;
  status?: string;
};

export type RosterShiftCandidate = {
  staff_id: string;
  clinic_id: string | null;
  shift_type: string;
  starts_at: string;
  ends_at: string;
  shift_source: StandardHoursShiftSource;
  notes: string | null;
  localDate: string;
  weekday: number;
};

export type RosterGenerationSkipReason =
  | "not_working_day"
  | "duplicate_shift"
  | "manual_shift_preserved"
  | "leave_blocked"
  | "unavailable_blocked"
  | "no_standard_hours";

export type RosterGenerationSkip = {
  staff_id: string;
  localDate: string;
  reason: RosterGenerationSkipReason;
  detail?: string;
};

export type GenerateRosterFromStandardHoursInput = {
  tenantId: string;
  staffIds: string[];
  standardHoursByStaff: Map<string, StaffStandardHoursDayInput[]>;
  staffTimezoneById: Map<string, string>;
  rangeStartIso: string;
  rangeEndIso: string;
  existingShifts: ExistingShiftForGeneration[];
  availabilityBlocks: AvailabilityBlockForGeneration[];
  /** When true, replace existing standard_hours shifts only; manual shifts always preserved. */
  overwriteGeneratedOnly?: boolean;
  rosterCadence?: RosterCadence;
  rosterCycleAnchorDate?: string;
};

export type GenerateRosterFromStandardHoursResult = {
  candidates: RosterShiftCandidate[];
  skips: RosterGenerationSkip[];
  shiftIdsToReplace: string[];
  cadence: RosterCadence;
  summary: {
    generatedCount: number;
    skippedManualCount: number;
    skippedLeaveCount: number;
    skippedUnavailableCount: number;
    skippedDuplicateCount: number;
    skippedNotWorkingCount: number;
    skippedNoStandardHoursCount: number;
  };
};

const BLOCKING_BLOCK_TYPES = new Set<AvailabilityBlockType>([
  "unavailable",
  "leave",
  "sick_leave",
  "training",
  "admin",
]);

function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return ms;
}

function localDateInTz(iso: string, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeCalendarTimezone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(iso));
}

export function weekdayIndexFromLocalDate(localDate: string): number {
  const d = new Date(`${localDate}T12:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

/** Build UTC ISO range from local date + HH:mm wall times in staff TZ. */
export function localWallTimeToUtcRange(
  localDate: string,
  startHm: string,
  endHm: string,
  staffTz: string
): { startsAt: string; endsAt: string } {
  const tz = normalizeCalendarTimezone(staffTz);
  const start = wallTimeToUtcIso(localDate, startHm, tz);
  const end = wallTimeToUtcIso(localDate, endHm, tz);
  if (Date.parse(end) <= Date.parse(start)) {
    throw new Error("End time must be after start time.");
  }
  return { startsAt: start, endsAt: end };
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

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function shiftTypeFromStandardDay(day: StaffStandardHoursDayInput): string {
  const role = day.role_code?.trim().toLowerCase();
  if (role === "theatre" || role === "surgeon" || role === "nurse") return "surgery_day";
  if (role === "reception") return "clinic_day";
  if (day.shift_label?.toLowerCase().includes("surgery")) return "surgery_day";
  return "clinic_day";
}

function isBlockedByAvailability(
  blocks: AvailabilityBlockForGeneration[],
  startMs: number,
  endMs: number
): RosterGenerationSkipReason | null {
  for (const block of blocks) {
    if (block.status === "cancelled") continue;
    if (!BLOCKING_BLOCK_TYPES.has(block.block_type)) continue;
    const bStart = parseIsoMs(block.starts_at);
    const bEnd = parseIsoMs(block.ends_at);
    if (!rangesOverlap(startMs, endMs, bStart, bEnd)) continue;
    if (block.block_type === "leave" || block.block_type === "sick_leave") return "leave_blocked";
    return "unavailable_blocked";
  }
  return null;
}

function shiftIsoDate(isoDate: string, dayDelta: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

function enumerateLocalDates(rangeStartIso: string, rangeEndIso: string, tz: string): string[] {
  const startLocal = localDateInTz(rangeStartIso, tz);
  const endLocalExclusive = localDateInTz(rangeEndIso, tz);
  const dates: string[] = [];
  let cursor = startLocal;
  while (cursor < endLocalExclusive) {
    dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return dates;
}

function activeStandardDayForWeekday(
  days: StaffStandardHoursDayInput[],
  weekday: number,
  cycleWeek: 1 | 2 = 1
): StaffStandardHoursDayInput | null {
  const match =
    days.find((d) => d.weekday === weekday && normaliseCycleWeek(d.cycle_week) === cycleWeek) ??
    (cycleWeek === 1 ? days.find((d) => d.weekday === weekday && d.cycle_week == null) : null) ??
    (cycleWeek === 1 ? days.find((d) => d.weekday === weekday) : null);
  return match ?? null;
}

function resolveCycleWeekForDate(
  localDate: string,
  cadence: RosterCadence,
  anchorDate: string
): 1 | 2 {
  if (cadence === "fortnightly") {
    return resolveFortnightCycleWeek(localDate, anchorDate);
  }
  return 1;
}

function buildGenerationSummary(
  candidates: RosterShiftCandidate[],
  skips: RosterGenerationSkip[]
): GenerateRosterFromStandardHoursResult["summary"] {
  return {
    generatedCount: candidates.length,
    skippedManualCount: skips.filter((s) => s.reason === "manual_shift_preserved").length,
    skippedLeaveCount: skips.filter((s) => s.reason === "leave_blocked").length,
    skippedUnavailableCount: skips.filter((s) => s.reason === "unavailable_blocked").length,
    skippedDuplicateCount: skips.filter((s) => s.reason === "duplicate_shift").length,
    skippedNotWorkingCount: skips.filter((s) => s.reason === "not_working_day").length,
    skippedNoStandardHoursCount: skips.filter((s) => s.reason === "no_standard_hours").length,
  };
}

function findExistingShiftForDay(
  existing: ExistingShiftForGeneration[],
  staffId: string,
  localDate: string,
  tz: string
): ExistingShiftForGeneration | null {
  for (const shift of existing) {
    if (shift.staff_id !== staffId) continue;
    if (shift.status === "cancelled") continue;
    if (localDateInTz(shift.starts_at, tz) === localDate) return shift;
  }
  return null;
}

/** Pure roster generation planner — returns shift candidates and skips. */
export function generateRosterFromStandardHours(
  input: GenerateRosterFromStandardHoursInput
): GenerateRosterFromStandardHoursResult {
  const candidates: RosterShiftCandidate[] = [];
  const skips: RosterGenerationSkip[] = [];
  const shiftIdsToReplace: string[] = [];
  const overwriteGenerated = input.overwriteGeneratedOnly ?? false;
  const cadence = input.rosterCadence ?? "weekly";
  const anchorDate = input.rosterCycleAnchorDate ?? "2026-01-05";

  for (const staffId of input.staffIds) {
    const days = input.standardHoursByStaff.get(staffId) ?? [];
    if (!days.length) {
      skips.push({ staff_id: staffId, localDate: "", reason: "no_standard_hours" });
      continue;
    }

    const tz =
      input.staffTimezoneById.get(staffId)?.trim() ||
      DEFAULT_STAFF_HOURS_FALLBACK_TZ;
    const staffBlocks = input.availabilityBlocks;
    const staffShifts = input.existingShifts.filter((s) => s.staff_id === staffId);
    const localDates = enumerateLocalDates(input.rangeStartIso, input.rangeEndIso, tz);

    for (const localDate of localDates) {
      const weekday = weekdayIndexFromLocalDate(localDate);
      const cycleWeek = resolveCycleWeekForDate(localDate, cadence, anchorDate);
      const day = activeStandardDayForWeekday(days, weekday, cycleWeek);

      if (!day || !day.is_working_day) {
        skips.push({
          staff_id: staffId,
          localDate,
          reason: "not_working_day",
          detail: day?.shift_label === "RDO" ? "RDO" : undefined,
        });
        continue;
      }

      const startHm = day.start_time?.trim();
      const endHm = day.end_time?.trim();
      if (!startHm || !endHm) {
        skips.push({ staff_id: staffId, localDate, reason: "no_standard_hours" });
        continue;
      }

      let range: { startsAt: string; endsAt: string };
      try {
        range = localWallTimeToUtcRange(localDate, startHm, endHm, tz);
      } catch {
        skips.push({ staff_id: staffId, localDate, reason: "no_standard_hours" });
        continue;
      }

      const startMs = parseIsoMs(range.startsAt);
      const endMs = parseIsoMs(range.endsAt);

      const blockReason = isBlockedByAvailability(staffBlocks, startMs, endMs);
      if (blockReason) {
        skips.push({ staff_id: staffId, localDate, reason: blockReason });
        continue;
      }

      const existing = findExistingShiftForDay(staffShifts, staffId, localDate, tz);
      if (existing) {
        const source = existing.shift_source ?? "manual";
        if (source !== "standard_hours") {
          skips.push({
            staff_id: staffId,
            localDate,
            reason: "manual_shift_preserved",
            detail: existing.id,
          });
          continue;
        }
        if (!overwriteGenerated) {
          skips.push({
            staff_id: staffId,
            localDate,
            reason: "duplicate_shift",
            detail: existing.id,
          });
          continue;
        }
        shiftIdsToReplace.push(existing.id);
      }

      const notes = day.shift_label?.trim()
        ? `Generated from standard hours — ${day.shift_label}`
        : "Generated from standard hours";

      candidates.push({
        staff_id: staffId,
        clinic_id: day.clinic_id?.trim() || null,
        shift_type: shiftTypeFromStandardDay(day),
        starts_at: range.startsAt,
        ends_at: range.endsAt,
        shift_source: "standard_hours",
        notes,
        localDate,
        weekday,
      });
    }
  }

  return {
    candidates,
    skips,
    shiftIdsToReplace,
    cadence,
    summary: buildGenerationSummary(candidates, skips),
  };
}

export type CopyPreviousRosterPeriodInput = {
  existingShifts: ExistingShiftForGeneration[];
  staffIds: string[];
  targetPeriodStartIso: string;
  staffTimezoneById: Map<string, string>;
  cadence: RosterCadence;
};

/** Copy shifts from the previous roster period into the target period. */
export function copyPreviousRosterPeriodShifts(
  input: CopyPreviousRosterPeriodInput
): RosterShiftCandidate[] {
  const targetStart = input.targetPeriodStartIso.slice(0, 10);
  const dayCount =
    input.cadence === "weekly"
      ? 7
      : input.cadence === "fortnightly"
        ? 14
        : rosterMonthDayCount(targetStart);
  const prevStart = shiftIsoDate(targetStart, -dayCount);
  const prevEnd = shiftIsoDate(targetStart, -1);
  const out: RosterShiftCandidate[] = [];

  for (const staffId of input.staffIds) {
    const tz =
      input.staffTimezoneById.get(staffId)?.trim() ||
      DEFAULT_STAFF_HOURS_FALLBACK_TZ;
    const staffShifts = input.existingShifts.filter((s) => s.staff_id === staffId);

    for (const shift of staffShifts) {
      if (shift.status === "cancelled") continue;
      const localDate = localDateInTz(shift.starts_at, tz);
      if (localDate < prevStart || localDate > prevEnd) continue;

      const dayOffset = daysBetweenIso(prevStart, localDate);
      const targetDate = shiftIsoDate(targetStart, dayOffset);
      const startHm = formatHmInTz(shift.starts_at, tz);
      const endHm = formatHmInTz(shift.ends_at, tz);
      const range = localWallTimeToUtcRange(targetDate, startHm, endHm, tz);
      const weekday = weekdayIndexFromLocalDate(targetDate);

      out.push({
        staff_id: staffId,
        clinic_id: null,
        shift_type: "clinic_day",
        starts_at: range.startsAt,
        ends_at: range.endsAt,
        shift_source: "copy_week",
        notes: copyPreviousPeriodNotes(input.cadence),
        localDate: targetDate,
        weekday,
      });
    }
  }

  return out;
}

function rosterMonthDayCount(monthStartIso: string): number {
  const [y, m] = monthStartIso.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = new Date(`${startIso.slice(0, 10)}T12:00:00.000Z`);
  const end = new Date(`${endIso.slice(0, 10)}T12:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function copyPreviousPeriodNotes(cadence: RosterCadence): string {
  switch (cadence) {
    case "fortnightly":
      return "Copied from previous fortnight";
    case "monthly":
      return "Copied from previous month";
    default:
      return "Copied from previous week";
  }
}

/** Copy shifts from the previous week into the target week. */
export function copyPreviousWeekShifts(input: {
  existingShifts: ExistingShiftForGeneration[];
  staffIds: string[];
  targetWeekStartIso: string;
  staffTimezoneById: Map<string, string>;
}): RosterShiftCandidate[] {
  return copyPreviousRosterPeriodShifts({
    existingShifts: input.existingShifts,
    staffIds: input.staffIds,
    targetPeriodStartIso: input.targetWeekStartIso,
    staffTimezoneById: input.staffTimezoneById,
    cadence: "weekly",
  });
}

function formatHmInTz(iso: string, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: normalizeCalendarTimezone(tz),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(iso)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  return `${parts.hour}:${parts.minute}`;
}

export { mondayOfWeekIso, weekDayIsoDates } from "@/src/lib/workforce-os/staffStandardHoursCore";

export function buildCoverageRoleGapLabels(
  missingRoles: Array<{ role: string; required: number; assigned: number }>
): string[] {
  return missingRoles
    .filter((r) => r.required > r.assigned)
    .map((r) => {
      const open = r.required - r.assigned;
      const label = formatRoleGapLabel(r.role);
      return open > 1 ? `Missing ${open} × ${label}` : `Missing ${label}`;
    });
}

function formatRoleGapLabel(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "rn" || r === "registered_nurse") return "RN";
  if (r === "consultant") return "consultant";
  if (r === "doctor" || r === "physician") return "doctor";
  if (r === "surgeon") return "surgeon";
  if (r === "nurse") return "nurse";
  return role.replace(/_/g, " ");
}

export function shiftSourceDisplayLabel(source: StandardHoursShiftSource | null | undefined): string {
  switch (source) {
    case "standard_hours":
      return "Generated from standard hours";
    case "copy_week":
      return "Copied from previous period";
    case "manual":
    default:
      return "Manual adjustment";
  }
}

export function blockTypeDisplayLabel(blockType: AvailabilityBlockType): string {
  switch (blockType) {
    case "leave":
      return "Leave";
    case "sick_leave":
      return "Leave";
    case "unavailable":
      return "Unavailable";
    case "training":
      return "Training";
    case "admin":
      return "Admin";
    case "available_override":
      return "Available override";
    default:
      return blockType;
  }
}
