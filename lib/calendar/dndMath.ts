import type { DragEndEvent } from "@dnd-kit/core";

import { calendarPxPerMinute } from "@/components/calendar/ProviderColumn";
import type { BusinessGridConfig } from "@/src/lib/calendar/operationalCalendarLayout";

export const CALENDAR_SNAP_MINUTES = 15;
export const CALENDAR_MIN_DURATION_MINUTES = 15;

export function minutesUtcFromEpoch(ms: number): number {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function snapCalendarMinutes(minutes: number, cfg: BusinessGridConfig): number {
  const gridStart = cfg.dayStartHourUtc * 60;
  const gridEnd = cfg.dayEndHourUtc * 60;
  const clamped = Math.min(Math.max(minutes, gridStart), gridEnd - CALENDAR_SNAP_MINUTES);
  const rel = clamped - gridStart;
  const snapped = Math.round(rel / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES + gridStart;
  return Math.min(snapped, gridEnd - CALENDAR_SNAP_MINUTES);
}

export function snapDurationMinutes(minutes: number): number {
  return Math.max(
    CALENDAR_MIN_DURATION_MINUTES,
    Math.round(minutes / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES
  );
}

export function pxFromDurationMinutes(minutes: number): number {
  return snapDurationMinutes(minutes) * calendarPxPerMinute();
}

export function durationMinutesFromPx(px: number): number {
  return snapDurationMinutes(px / calendarPxPerMinute());
}

/** Drop Y → snapped UTC minutes within the business-day grid. */
export function dropMinutesFromDragEvent(
  event: DragEndEvent,
  cfg: BusinessGridConfig,
  fallbackStartMin: number
): number {
  const { active, over, delta } = event;
  const translated = active.rect.current.translated;
  const overRect = over?.rect;

  if (translated && overRect) {
    const centerY = translated.top + translated.height / 2 - overRect.top;
    const gridStart = cfg.dayStartHourUtc * 60;
    const rawMin = gridStart + centerY / calendarPxPerMinute();
    return snapCalendarMinutes(rawMin, cfg);
  }

  const deltaMin = delta.y / calendarPxPerMinute();
  return snapCalendarMinutes(fallbackStartMin + deltaMin, cfg);
}
