"use client";

import {
  calendarGridBodyHeightPx,
  calendarSlotHeightPx,
  generateCalendarTimeSlots,
} from "@/lib/calendar/time-slots";
import { fiCrmCalendarGridClassNames } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { DEFAULT_CALENDAR_TIMEZONE } from "@/src/lib/calendar/calendarTimezone";

export type BusinessTimeSlotGridProps = {
  /** Override body height; defaults to full 8 AM–6 PM window. */
  bodyHeightPx?: number;
  className?: string;
};

/**
 * Always-visible 8 AM–6 PM slot grid (30-min increments).
 * Renders even when a column has zero appointments.
 */
export function BusinessTimeSlotGrid({
  bodyHeightPx,
  className,
  timeZone = DEFAULT_CALENDAR_TIMEZONE,
}: BusinessTimeSlotGridProps & { timeZone?: string }) {
  const slots = generateCalendarTimeSlots(timeZone);
  const slotH = calendarSlotHeightPx();
  const height = bodyHeightPx ?? calendarGridBodyHeightPx();

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 bg-[#0f172a]", className)}
      style={{ minHeight: height }}
      aria-hidden
    >
      {slots.map((slot, i) => (
        <div
          key={slot.start}
          className={cn(
            "absolute inset-x-0 border-t",
            i % 2 === 0 ? fiCrmCalendarGridClassNames.slotLine : fiCrmCalendarGridClassNames.slotLineHalf
          )}
          style={{ top: i * slotH, height: slotH }}
        />
      ))}
      <div
        className={cn("absolute inset-x-0 border-t", fiCrmCalendarGridClassNames.slotLine)}
        style={{ top: height - 1 }}
      />
    </div>
  );
}

/**
 * Time gutter labels aligned to {@link CALENDAR_TIME_SLOTS} (hour marks only).
 */
export function BusinessTimeGutter({
  bodyHeightPx,
  headerHeightPx = 56,
  timeZone = DEFAULT_CALENDAR_TIMEZONE,
}: {
  bodyHeightPx?: number;
  headerHeightPx?: number;
  timeZone?: string;
}) {
  const slots = generateCalendarTimeSlots(timeZone);
  const slotH = calendarSlotHeightPx();
  const height = bodyHeightPx ?? calendarGridBodyHeightPx();

  return (
    <div
      className={cn(
        "sticky left-0 z-20 w-[var(--fi-calendar-gutter,3.5rem)] shrink-0 self-start border-r",
        fiCrmCalendarGridClassNames.gutter
      )}
    >
      <div
        style={{ height: headerHeightPx }}
        className="sticky top-0 z-20 border-b border-[#1e2937] bg-[#0f172a]"
        aria-hidden
      />
      <div className="relative" style={{ height }}>
        {slots.filter((_, i) => i % 2 === 0).map((slot, hourIndex) => (
          <div
            key={slot.start}
            className="absolute left-0 right-0 flex items-start justify-end pr-2 pt-1"
            style={{ top: hourIndex * 2 * slotH, height: slotH * 2 }}
          >
            <span className={fiCrmCalendarGridClassNames.slotLabel}>{slot.start}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
