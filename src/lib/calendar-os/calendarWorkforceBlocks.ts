/**
 * CalendarOS V2 — weekday helpers + availability chrome derivation (pure).
 *
 * Leave / override / outside-hours labels come from roster
 * `getStaffAvailabilityForRange(...).explanation` — CalendarOS must not invent policy.
 */

import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import {
  calendarDateStringFromInstant,
  localClockMinutesFromInstant,
  parseIsoUtcMs,
  zonedMidnightUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import { CALENDAR_OS_LAYOUT_BASE_PX_PER_HOUR } from "@/src/lib/calendar-os/calendarDisplayDensity";
import type { ClinicalStaffPickerOption } from "@/src/lib/team/directory";
import {
  getStaffAvailabilityForRange,
  parseStaffWeeklyHours,
  type StaffAvailabilityBlockRecord,
  type StaffAvailabilitySource,
  type StaffWeekdayKey,
} from "@/src/lib/team/roster/availability";
import { staffColumnId } from "@/src/lib/calendar/operationalCalendarColumns";

export type CalendarOsWorkforceBlockKind =
  | "rdo"
  | "leave"
  | "sick_leave"
  | "lunch"
  | "unavailable"
  | "working_hours"
  | "available_override"
  | "outside_hours";

export type CalendarOsWorkforceBlock = {
  id: string;
  resourceId: string;
  dayKey: string;
  kind: CalendarOsWorkforceBlockKind;
  label: string;
  /** Day view vertical placement when applicable. */
  topPx?: number;
  heightPx?: number;
  /** Canonical explanation source when derived from effective availability. */
  explanationSource?: StaffAvailabilitySource;
};

export type CalendarOsAvailabilityBlockInput = {
  id: string;
  block_type: string;
  starts_at: string;
  ends_at: string;
  status?: string | null;
  reason?: string | null;
};

const WEEKDAY_TO_KEY: Record<number, StaffWeekdayKey> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  0: "sun",
};

/** Map clinic-local `YYYY-MM-DD` to staff weekly hours key. */
export function weekdayKeyFromDayKey(dayKey: string, timeZone: string): StaffWeekdayKey | null {
  const ms = zonedMidnightUtcMs(dayKey.trim(), timeZone);
  if (ms == null) return null;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "weekday")?.value;
  if (!weekday) return null;
  const map: Record<string, StaffWeekdayKey> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  };
  return map[weekday] ?? null;
}

export function weekdayIndexFromDayKey(dayKey: string, timeZone: string): number | null {
  const ms = zonedMidnightUtcMs(dayKey.trim(), timeZone);
  if (ms == null) return null;
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).formatToParts(
    new Date(ms)
  );
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return weekday != null ? (map[weekday] ?? null) : null;
}

export { WEEKDAY_TO_KEY };

export function calendarOsKindFromAvailabilitySource(
  source: StaffAvailabilitySource
): CalendarOsWorkforceBlockKind | null {
  switch (source) {
    case "weekly_hours":
      return "working_hours";
    case "available_override":
      return "available_override";
    case "leave":
    case "maternity_leave":
      return "leave";
    case "sick_leave":
      return "sick_leave";
    case "unavailable":
    case "training":
    case "admin":
      return "unavailable";
    case "outside_weekly_hours":
      return "outside_hours";
    default:
      return null;
  }
}

function parseHmToMinutes(hm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesRangeToDayPlacement(
  cfg: BusinessGridConfig,
  startMinFromMidnight: number,
  durationMin: number
): { topPx: number; heightPx: number } | null {
  const gridStart = cfg.dayStartHourUtc * 60;
  const gridEnd = cfg.dayEndHourUtc * 60;
  const visStart = Math.max(startMinFromMidnight, gridStart);
  const visEnd = Math.min(startMinFromMidnight + durationMin, gridEnd);
  if (visEnd <= visStart) return null;
  const pxPerMin = CALENDAR_OS_LAYOUT_BASE_PX_PER_HOUR / 60;
  return {
    topPx: (visStart - gridStart) * pxPerMin,
    heightPx: Math.max((visEnd - visStart) * pxPerMin, 12),
  };
}

function toBlockRecord(b: CalendarOsAvailabilityBlockInput): StaffAvailabilityBlockRecord {
  return {
    id: b.id,
    block_type: b.block_type as StaffAvailabilityBlockRecord["block_type"],
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: (b.status as StaffAvailabilityBlockRecord["status"]) || "active",
    reason: b.reason ?? null,
  };
}

function nextClinicDayKey(dayKey: string, timeZone: string): string {
  const dayStart = zonedMidnightUtcMs(dayKey, timeZone);
  if (dayStart == null) return dayKey;
  return calendarDateStringFromInstant(new Date(dayStart + 36 * 3600_000), timeZone);
}

function blockOverlapsClinicDay(
  block: CalendarOsAvailabilityBlockInput,
  dayKey: string,
  timeZone: string
): boolean {
  const startMs = parseIsoUtcMs(block.starts_at);
  const endMs = parseIsoUtcMs(block.ends_at);
  if (startMs == null || endMs == null || endMs <= startMs) return false;
  const dayStart = zonedMidnightUtcMs(dayKey, timeZone);
  if (dayStart == null) return false;
  const nextMidnight =
    zonedMidnightUtcMs(nextClinicDayKey(dayKey, timeZone), timeZone) ?? dayStart + 24 * 3600_000;
  return startMs < nextMidnight && endMs > dayStart;
}

/**
 * Derive staff-lane chrome for one clinic-local day.
 * Uses roster effective-availability explanations for leave / override / outside hours.
 */
export function deriveWorkforceBlocksForStaffRow(input: {
  staff: ClinicalStaffPickerOption;
  dayKey: string;
  gridConfig: BusinessGridConfig;
  lane: CalendarDayLane;
  availabilityBlocks?: CalendarOsAvailabilityBlockInput[];
  staffTimezone?: string | null;
}): CalendarOsWorkforceBlock[] {
  const { staff, dayKey, gridConfig } = input;
  const timeZone = gridConfig.timeZone;
  const staffTz = input.staffTimezone?.trim() || timeZone;
  const resourceId = staffColumnId(String(staff.id));
  const blocks: CalendarOsWorkforceBlock[] = [];
  const weekday = weekdayKeyFromDayKey(dayKey, timeZone);
  const weekly = parseStaffWeeklyHours(staff.working_hours ?? null);
  const dayHours = weekday ? weekly[weekday] : undefined;
  const rawBlocks = (input.availabilityBlocks ?? []).filter(
    (b) => (b.status ?? "active") === "active"
  );
  const blockRecords = rawBlocks.map(toBlockRecord);

  if (!staff.is_active) {
    blocks.push({
      id: `${resourceId}:${dayKey}:inactive`,
      resourceId,
      dayKey,
      kind: "unavailable",
      label: "Inactive",
    });
    return blocks;
  }

  const readiness = staff.clinical_readiness;
  if (readiness && !readiness.clinically_available) {
    blocks.push({
      id: `${resourceId}:${dayKey}:readiness`,
      resourceId,
      dayKey,
      kind: "leave",
      label: readiness.block_reason ?? readiness.warning_label ?? "Unavailable",
    });
  }

  if (weekday && dayHours && dayHours.enabled === false) {
    blocks.push({
      id: `${resourceId}:${dayKey}:rdo`,
      resourceId,
      dayKey,
      kind: "rdo",
      label: "RDO",
    });
  }

  // Weekly template chrome: normal hours band + outside-hours bands.
  if (weekday && dayHours?.start && dayHours?.end && dayHours.enabled !== false) {
    const workStart = parseHmToMinutes(dayHours.start);
    const workEnd = parseHmToMinutes(dayHours.end);
    if (workStart != null && workEnd != null && workEnd > workStart) {
      const dayStartMs = zonedMidnightUtcMs(dayKey, timeZone);
      const probeStart =
        dayStartMs != null
          ? new Date(dayStartMs + workStart * 60_000).toISOString()
          : `${dayKey}T${dayHours.start}:00.000Z`;
      const probeEnd =
        dayStartMs != null
          ? new Date(dayStartMs + Math.min(workStart + 60, workEnd) * 60_000).toISOString()
          : `${dayKey}T${dayHours.end}:00.000Z`;

      const weeklyExplanation = getStaffAvailabilityForRange({
        staffId: String(staff.id),
        startsAt: probeStart,
        endsAt: probeEnd,
        workingHours: staff.working_hours ?? null,
        staffTimezone: staffTz,
        availabilityBlocks: blockRecords,
        shifts: [],
      }).explanation;

      if (weeklyExplanation.source === "weekly_hours" || weeklyExplanation.available) {
        const placement = minutesRangeToDayPlacement(gridConfig, workStart, workEnd - workStart);
        if (placement) {
          blocks.push({
            id: `${resourceId}:${dayKey}:working_hours`,
            resourceId,
            dayKey,
            kind: "working_hours",
            label: weeklyExplanation.reason,
            explanationSource: weeklyExplanation.source,
            topPx: placement.topPx,
            heightPx: placement.heightPx,
          });
        }
      }

      const gridStart = gridConfig.dayStartHourUtc * 60;
      const gridEnd = gridConfig.dayEndHourUtc * 60;
      if (workStart > gridStart) {
        const before = minutesRangeToDayPlacement(gridConfig, gridStart, workStart - gridStart);
        if (before) {
          blocks.push({
            id: `${resourceId}:${dayKey}:outside_before`,
            resourceId,
            dayKey,
            kind: "outside_hours",
            label: "Outside normal weekly hours",
            explanationSource: "outside_weekly_hours",
            topPx: before.topPx,
            heightPx: before.heightPx,
          });
        }
      }
      if (workEnd < gridEnd) {
        const after = minutesRangeToDayPlacement(gridConfig, workEnd, gridEnd - workEnd);
        if (after) {
          blocks.push({
            id: `${resourceId}:${dayKey}:outside_after`,
            resourceId,
            dayKey,
            kind: "outside_hours",
            label: "Outside normal weekly hours",
            explanationSource: "outside_weekly_hours",
            topPx: after.topPx,
            heightPx: after.heightPx,
          });
        }
      }

      const lunchStartMin = parseHmToMinutes("12:00");
      const lunchEndMin = parseHmToMinutes("13:00");
      if (
        lunchStartMin != null &&
        lunchEndMin != null &&
        lunchStartMin >= workStart &&
        lunchEndMin <= workEnd
      ) {
        const placement = minutesRangeToDayPlacement(
          gridConfig,
          lunchStartMin,
          lunchEndMin - lunchStartMin
        );
        if (placement) {
          blocks.push({
            id: `${resourceId}:${dayKey}:lunch`,
            resourceId,
            dayKey,
            kind: "lunch",
            label: "Lunch",
            topPx: placement.topPx,
            heightPx: placement.heightPx,
          });
        }
      }
    }
  }

  // DB availability blocks overlapping this clinic day — labels from canonical explanation.
  const nextKey = nextClinicDayKey(dayKey, timeZone);
  for (const raw of rawBlocks) {
    if (!blockOverlapsClinicDay(raw, dayKey, timeZone)) continue;
    const startMs = parseIsoUtcMs(raw.starts_at);
    const endMs = parseIsoUtcMs(raw.ends_at);
    if (startMs == null || endMs == null) continue;

    const explanation = getStaffAvailabilityForRange({
      staffId: String(staff.id),
      startsAt: raw.starts_at,
      endsAt: raw.ends_at,
      workingHours: staff.working_hours ?? null,
      staffTimezone: staffTz,
      availabilityBlocks: blockRecords,
      shifts: [],
    }).explanation;

    const kind =
      calendarOsKindFromAvailabilitySource(explanation.source) ??
      (raw.block_type === "available_override"
        ? "available_override"
        : raw.block_type === "sick_leave"
          ? "sick_leave"
          : raw.block_type === "leave" || raw.block_type === "maternity_leave"
            ? "leave"
            : "unavailable");

    const startMin = localClockMinutesFromInstant(startMs, timeZone);
    const endMin = localClockMinutesFromInstant(endMs, timeZone);
    const startDay = calendarDateStringFromInstant(new Date(startMs), timeZone);
    const endDay = calendarDateStringFromInstant(new Date(endMs), timeZone);

    // Full-day overlay when the block covers the entire clinic day (or more).
    const coversFullDay =
      (startDay < dayKey || (startDay === dayKey && (startMin ?? 0) <= gridConfig.dayStartHourUtc * 60)) &&
      (endDay > dayKey ||
        (endDay === dayKey && (endMin ?? 24 * 60) >= gridConfig.dayEndHourUtc * 60) ||
        endDay >= nextKey);

    if (coversFullDay && raw.block_type !== "available_override") {
      blocks.push({
        id: `${resourceId}:${dayKey}:block:${raw.id}`,
        resourceId,
        dayKey,
        kind,
        label: explanation.reason,
        explanationSource: explanation.source,
      });
      continue;
    }

    const clampedStart =
      startDay < dayKey ? gridConfig.dayStartHourUtc * 60 : (startMin ?? gridConfig.dayStartHourUtc * 60);
    const clampedEnd =
      endDay > dayKey ? gridConfig.dayEndHourUtc * 60 : (endMin ?? gridConfig.dayEndHourUtc * 60);
    if (clampedEnd <= clampedStart) continue;
    const placement = minutesRangeToDayPlacement(
      gridConfig,
      clampedStart,
      clampedEnd - clampedStart
    );
    if (!placement) continue;
    blocks.push({
      id: `${resourceId}:${dayKey}:block:${raw.id}`,
      resourceId,
      dayKey,
      kind,
      label: explanation.reason,
      explanationSource: explanation.source,
      topPx: placement.topPx,
      heightPx: placement.heightPx,
    });
  }

  return blocks;
}
