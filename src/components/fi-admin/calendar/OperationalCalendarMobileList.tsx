"use client";

import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import { cn } from "@/lib/utils";

export function OperationalCalendarMobileList({
  lanes,
  buckets,
  bookingDisplay,
  onSelectBooking,
}: {
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  bookingDisplay: Record<string, OperationalCalendarBookingDisplay>;
  onSelectBooking: (b: FiBookingRow) => void;
}) {
  return (
    <div className="space-y-4 lg:hidden">
      {lanes.map((lane) => {
        const items = [...(buckets[lane.dayKey] ?? [])].sort((a, b) => a.start_at.localeCompare(b.start_at));
        return (
          <section key={lane.dayKey} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{calendarDayHeading(lane)}</h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No bookings in this range.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((b) => {
                  const d = bookingDisplay[b.id];
                  const label = d?.anchorLabel ?? "Booking";
                  const range = `${new Date(b.start_at).toLocaleTimeString(undefined, { timeStyle: "short", timeZone: "UTC" })} UTC`;
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => onSelectBooking(b)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        )}
                      >
                        <span className="font-medium text-slate-900 dark:text-slate-100">{label}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{range}</span>
                        {d?.scalesSummary ? (
                          <span className="text-xs text-slate-700 dark:text-slate-300">{d.scalesSummary}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
