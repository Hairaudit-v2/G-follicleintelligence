"use client";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import {
  CALENDAR_DAY_COLUMN_HEIGHT_PX,
  CALENDAR_GRID_PX_PER_HOUR,
  layoutBookingUtcDayColumn,
  utcHourSlotIsoRange,
} from "@/src/lib/bookings/calendarView";
import { calendarDayHeading } from "@/src/lib/bookings/calendarLabels";
import { displayCalendarTimezoneSubtitle } from "@/src/lib/calendar/calendarTimezone";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BookingCalendarEventCard } from "./BookingCalendarEventCard";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BookingCalendarDayView({
  lane,
  events,
  assignees,
  onSelectBooking,
  onEmptySlot,
}: {
  lane: CalendarDayLane;
  events: FiBookingRow[];
  assignees: CrmShellUserPickerOption[];
  onSelectBooking: (b: FiBookingRow) => void;
  onEmptySlot: (dayKey: string, hour: number) => void;
}) {
  return (
    <div className="flex w-full rounded border border-gray-200 bg-white">
      <div
        className="w-12 shrink-0 border-r border-gray-200 bg-gray-50 text-[10px] text-gray-500"
        style={{ paddingTop: 48 }}
      >
        {HOURS.map((h) => (
          <div
            key={h}
            className="border-t border-gray-100 pr-1 text-right"
            style={{ height: CALENDAR_GRID_PX_PER_HOUR }}
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-sm font-medium text-gray-900">
          {calendarDayHeading(lane)}
          <span className="ml-2 text-xs font-normal text-gray-500">{displayCalendarTimezoneSubtitle(lane.timeZone)}</span>
        </div>
        <div className="relative" style={{ height: CALENDAR_DAY_COLUMN_HEIGHT_PX }}>
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              aria-label={`Create booking ${lane.dayKey} ${String(h).padStart(2, "0")}:00 (${displayCalendarTimezoneSubtitle(lane.timeZone)})`}
              className="absolute left-0 right-0 border-t border-gray-100 hover:bg-primary/5"
              style={{ top: h * CALENDAR_GRID_PX_PER_HOUR, height: CALENDAR_GRID_PX_PER_HOUR }}
              onClick={() => {
                if (utcHourSlotIsoRange(lane.dayKey, h, lane.timeZone)) onEmptySlot(lane.dayKey, h);
              }}
            />
          ))}
          {events.map((b) => {
            const layout = layoutBookingUtcDayColumn(b, lane);
            if (!layout) return null;
            return (
              <BookingCalendarEventCard
                key={b.id}
                booking={b}
                assignees={assignees}
                layout={layout}
                onClick={() => onSelectBooking(b)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
