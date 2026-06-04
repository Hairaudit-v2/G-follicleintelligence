"use client";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { CalendarViewMode } from "@/src/lib/bookings/calendarQuery";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BookingCalendarDayView } from "./BookingCalendarDayView";
import { BookingCalendarWeekView } from "./BookingCalendarWeekView";

export function BookingCalendarGrid({
  view,
  lanes,
  buckets,
  assignees,
  onSelectBooking,
  onEmptySlot,
}: {
  view: CalendarViewMode;
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  assignees: CrmShellUserPickerOption[];
  onSelectBooking: (b: FiBookingRow) => void;
  onEmptySlot: (dayKey: string, hour: number) => void;
}) {
  if (view === "day" && lanes[0]) {
    const lane = lanes[0];
    return (
      <BookingCalendarDayView
        lane={lane}
        events={buckets[lane.dayKey] ?? []}
        assignees={assignees}
        onSelectBooking={onSelectBooking}
        onEmptySlot={onEmptySlot}
      />
    );
  }
  return (
    <BookingCalendarWeekView
      lanes={lanes}
      buckets={buckets}
      assignees={assignees}
      onSelectBooking={onSelectBooking}
      onEmptySlot={onEmptySlot}
    />
  );
}
