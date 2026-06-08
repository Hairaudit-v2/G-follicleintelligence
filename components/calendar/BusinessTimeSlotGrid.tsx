"use client";

import { useMemo } from "react";

import {
  calendarGridBodyHeightForBusinessHours,
  calendarSlotHeightPx,
  generateOperationalCalendarTimeSlots,
  type OperationalGridHours,
} from "@/lib/calendar/time-slots";
import { fiCrmCalendarGridClassNames } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export type BusinessTimeSlotGridProps = {
  /** Override body height; defaults to span of `gridHours`. */
  bodyHeightPx?: number;
  className?: string;
  /** Clinic-local business window (hour fields are wall-clock, not UTC offsets). */
  gridHours: OperationalGridHours;
};

/**
 * Visible business-day slot grid (30-min rows). Lines and labels use wall-clock minutes only.
 */
export function BusinessTimeSlotGrid({ bodyHeightPx, className, gridHours }: BusinessTimeSlotGridProps) {
  const { dayStartHourUtc, dayEndHourUtc } = gridHours;
  const slots = useMemo(
    () => generateOperationalCalendarTimeSlots({ dayStartHourUtc, dayEndHourUtc }),
    [dayStartHourUtc, dayEndHourUtc]
  );
  const slotH = calendarSlotHeightPx();
  const height = bodyHeightPx ?? calendarGridBodyHeightForBusinessHours(gridHours);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 bg-[#0f172a]", className)}
      style={{ minHeight: height }}
      aria-hidden
    >
      {slots.map((slot, i) => (
        <div
          key={`${gridHours.dayStartHourUtc}-${i}`}
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
 * Time gutter labels on full-hour marks for the same business window as {@link BusinessTimeSlotGrid}.
 */
export function BusinessTimeGutter({
  bodyHeightPx,
  headerHeightPx = 56,
  gridHours,
}: {
  bodyHeightPx?: number;
  headerHeightPx?: number;
  gridHours: OperationalGridHours;
}) {
  const { dayStartHourUtc, dayEndHourUtc } = gridHours;
  const slots = useMemo(
    () => generateOperationalCalendarTimeSlots({ dayStartHourUtc, dayEndHourUtc }),
    [dayStartHourUtc, dayEndHourUtc]
  );
  const slotH = calendarSlotHeightPx();
  const height = bodyHeightPx ?? calendarGridBodyHeightForBusinessHours(gridHours);

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
            key={`gutter-${gridHours.dayStartHourUtc}-${hourIndex}`}
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
