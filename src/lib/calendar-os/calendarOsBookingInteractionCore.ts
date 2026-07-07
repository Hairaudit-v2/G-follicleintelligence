/**
 * CalendarOS — click/drag interaction policy (pure).
 */

import type { DragEndEvent } from "@dnd-kit/core";

import {
  calendarOsSourceLabelForProvider,
  isCalendarOsEventRow,
  resolveCalendarOsProviderKind,
} from "@/src/lib/calendar/calendarOsEventsCore";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import {
  calendarDateStringFromInstant,
  clinicLocalSlotToUtcIso,
  localClockMinutesFromInstant,
  minutesFromLaneStart,
  parseIsoUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";
import { snapCalendarMinutes } from "@/lib/calendar/dndMath";

export const FI_LOCAL_RESCHEDULE_META_FLAG = "rescheduled_in_fi_os" as const;
export const FI_SOURCE_SYNC_STATUS_KEY = "source_sync_status" as const;
export const FI_SOURCE_SYNC_LOCAL_OVERRIDE = "local_override" as const;

export function isTimelyImportedBooking(row: Pick<FiBookingRow, "metadata">): boolean {
  return String(row.metadata?.source_system ?? "")
    .trim()
    .toLowerCase() === "timely";
}

export function isBookingDragMutable(
  row: Pick<FiBookingRow, "metadata" | "booking_status" | "cancelled_at">
): boolean {
  if (isCalendarOsEventRow(row)) return false;
  if (row.booking_status === "completed") return false;
  if (isBookingCancelled(row)) return false;
  return true;
}

export function bookingNeedsSourceUpdateWarning(row: Pick<FiBookingRow, "metadata">): boolean {
  const meta = row.metadata ?? {};
  if (isCalendarOsEventRow(row)) return false;
  if (meta[FI_SOURCE_SYNC_STATUS_KEY] === FI_SOURCE_SYNC_LOCAL_OVERRIDE) return true;
  return meta[FI_LOCAL_RESCHEDULE_META_FLAG] === true;
}

export function externalRescheduleRequiresFiOnlyConfirmation(
  row: Pick<FiBookingRow, "metadata">
): boolean {
  return isTimelyImportedBooking(row);
}

export function externalSourceLabelForBooking(
  row: FiBookingRow,
  display?: OperationalCalendarBookingDisplay
): string | null {
  if (display?.calendarOsSourceLabel?.trim()) return display.calendarOsSourceLabel.trim();
  if (isCalendarOsEventRow(row)) {
    return calendarOsSourceLabelForProvider(resolveCalendarOsProviderKind(row.metadata));
  }
  if (isTimelyImportedBooking(row)) return "Timely";
  return null;
}

export function buildLocalRescheduleMetadataPatch(
  existing: Record<string, unknown> | null | undefined,
  booking: FiBookingRow,
  originalStart: string,
  originalEnd: string
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  if (isCalendarOsEventRow(booking)) return base;
  if (!isTimelyImportedBooking(booking)) return base;

  const patch: Record<string, unknown> = {
    ...base,
    [FI_LOCAL_RESCHEDULE_META_FLAG]: true,
    [FI_SOURCE_SYNC_STATUS_KEY]: FI_SOURCE_SYNC_LOCAL_OVERRIDE,
    fi_local_reschedule_at: new Date().toISOString(),
  };
  if (!base.original_external_start_at) patch.original_external_start_at = originalStart;
  if (!base.original_external_end_at) patch.original_external_end_at = originalEnd;
  return patch;
}

export function parseCalendarOsDayDropId(id: string): { dayKey: string; columnId: string } | null {
  if (!id.startsWith("drop:")) return null;
  const rest = id.slice(5);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  return { dayKey: rest.slice(0, sep), columnId: rest.slice(sep + 1) };
}

export function calendarOsWeekDropId(dayKey: string, resourceId: string): string {
  return `week-drop:${dayKey}:${resourceId}`;
}

export function parseCalendarOsWeekDropId(
  id: string
): { dayKey: string; resourceId: string } | null {
  if (!id.startsWith("week-drop:")) return null;
  const rest = id.slice(10);
  const sep = rest.indexOf(":");
  if (sep <= 0) return null;
  return { dayKey: rest.slice(0, sep), resourceId: rest.slice(sep + 1) };
}

/** Drop Y → snapped local minutes within the business-day grid (V2 density-aware). */
export function dropMinutesFromDragEventWithPx(
  event: DragEndEvent,
  cfg: BusinessGridConfig,
  fallbackStartMin: number,
  pxPerMinute: number
): number {
  if (!(pxPerMinute > 0)) return snapCalendarMinutes(fallbackStartMin, cfg);

  const { active, over, delta } = event;
  const translated = active.rect.current.translated;
  const overRect = over?.rect;

  if (translated && overRect) {
    const centerY = translated.top + translated.height / 2 - overRect.top;
    const gridStart = cfg.dayStartHourUtc * 60;
    const rawMin = gridStart + centerY / pxPerMinute;
    return snapCalendarMinutes(rawMin, cfg);
  }

  const deltaMin = delta.y / pxPerMinute;
  return snapCalendarMinutes(fallbackStartMin + deltaMin, cfg);
}

export type CalendarOsDragReschedulePlan = {
  startIso: string;
  endIso: string;
  columnId: string;
};

export function planDayViewDragReschedule(input: {
  booking: FiBookingRow;
  lane: CalendarDayLane;
  drop: { dayKey: string; columnId: string };
  event: DragEndEvent;
  gridConfig: BusinessGridConfig;
  pxPerMinute: number;
}): CalendarOsDragReschedulePlan | null {
  const origStartMs = parseIsoUtcMs(input.booking.start_at);
  const origEndMs = parseIsoUtcMs(input.booking.end_at);
  if (origStartMs == null || origEndMs == null) return null;

  const durationMs = Math.max(15 * 60_000, origEndMs - origStartMs);
  const origStartMin = minutesFromLaneStart(input.lane.startMs, origStartMs);
  const newStartMin = dropMinutesFromDragEventWithPx(
    input.event,
    input.gridConfig,
    origStartMin,
    input.pxPerMinute
  );
  const newEndMin = newStartMin + durationMs / 60_000;
  const startIso = clinicLocalSlotToUtcIso(
    input.drop.dayKey,
    newStartMin,
    input.gridConfig.timeZone
  );
  const endIso = clinicLocalSlotToUtcIso(input.drop.dayKey, newEndMin, input.gridConfig.timeZone);
  if (!startIso || !endIso) return null;

  return { startIso, endIso, columnId: input.drop.columnId };
}

export function planWeekCellDragReschedule(input: {
  booking: FiBookingRow;
  drop: { dayKey: string; resourceId: string };
  lane: CalendarDayLane | undefined;
  gridConfig: BusinessGridConfig;
}): CalendarOsDragReschedulePlan | null {
  const origStartMs = parseIsoUtcMs(input.booking.start_at);
  const origEndMs = parseIsoUtcMs(input.booking.end_at);
  if (origStartMs == null || origEndMs == null) return null;

  const durationMin = Math.max(
    15,
    Math.round((origEndMs - origStartMs) / 60_000) || 30
  );
  const origDayKey = calendarDateStringFromInstant(new Date(origStartMs), input.gridConfig.timeZone);
  let startMin =
    localClockMinutesFromInstant(origStartMs, input.gridConfig.timeZone) ??
    input.gridConfig.dayStartHourUtc * 60 + 60;
  if (input.lane && origDayKey === input.lane.dayKey) {
    startMin = minutesFromLaneStart(input.lane.startMs, origStartMs);
  }
  startMin = snapCalendarMinutes(startMin, input.gridConfig);
  const endMin = startMin + durationMin;
  const startIso = clinicLocalSlotToUtcIso(
    input.drop.dayKey,
    startMin,
    input.gridConfig.timeZone
  );
  const endIso = clinicLocalSlotToUtcIso(input.drop.dayKey, endMin, input.gridConfig.timeZone);
  if (!startIso || !endIso) return null;

  return { startIso, endIso, columnId: input.drop.resourceId };
}
