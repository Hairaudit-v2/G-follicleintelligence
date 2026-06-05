"use client";

import type { DragEvent } from "react";

import { cn } from "@/lib/utils";
import { isBookingCancelled } from "@/src/lib/bookings";
import {
  bookingCalendarChipSurface,
  bookingTypeCalendarLegendLabel,
} from "@/src/lib/bookings/calendarLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import { formatTimeRangeInTimezone, normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";

export function BookingCalendarCard({
  booking,
  display,
  layout,
  draggable,
  onClick,
  onDragStart,
  calendarTimezone,
}: {
  booking: FiBookingRow;
  display: OperationalCalendarBookingDisplay;
  layout: { topPx: number; heightPx: number };
  draggable: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent) => void;
  /** IANA zone from tenant settings (defaults to UTC). */
  calendarTimezone?: string | null;
}) {
  const cancelled = isBookingCancelled(booking);
  const completed = booking.booking_status === "completed";
  const chip = bookingCalendarChipSurface(booking.booking_type, display.procedureCatalogHex ?? null);
  const typeLabel = display.procedureCatalogName?.trim() || bookingTypeCalendarLegendLabel(booking.booking_type);
  const tz = normalizeCalendarTimezone(calendarTimezone ?? booking.timezone);
  const range = formatTimeRangeInTimezone(booking.start_at, booking.end_at, tz);

  return (
    <button
      type="button"
      draggable={draggable && !cancelled && !completed}
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "absolute left-0.5 right-0.5 z-[1] overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] shadow-sm transition hover:z-[2] hover:brightness-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500",
        chip.toneClasses,
        cancelled || completed ? "opacity-60" : ""
      )}
      style={{ top: layout.topPx, height: layout.heightPx, minHeight: 22, ...chip.chipStyle }}
    >
      <div className="truncate font-semibold leading-tight">{display.anchorLabel}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide opacity-90">{typeLabel}</span>
        <BookingStatusBadge status={booking.booking_status} />
      </div>
      <div className="mt-0.5 truncate text-[10px] tabular-nums opacity-90">{range}</div>
      <div className="mt-0.5 text-[10px] opacity-90">{display.durationMin} min</div>
      {display.scalesSummary ? (
        <div className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-slate-800/95">{display.scalesSummary}</div>
      ) : null}
      {display.reminderHint ? (
        <div className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-snug text-sky-800/95 dark:text-sky-200/90">
          {display.reminderHint}
        </div>
      ) : null}
    </button>
  );
}
