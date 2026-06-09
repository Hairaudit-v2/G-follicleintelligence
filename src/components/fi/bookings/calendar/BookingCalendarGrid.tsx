"use client";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";
import type { CalendarViewMode } from "@/src/lib/bookings/calendarQuery";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { BookingCalendarDayView } from "./BookingCalendarDayView";
import { BookingCalendarWeekView } from "./BookingCalendarWeekView";

export function BookingCalendarGrid({
  view,
  lanes,
  buckets,
  clinicalStaffOptions,
  userAssignees = [],
  services = [],
  onSelectBooking,
  onEmptySlot,
}: {
  view: CalendarViewMode;
  lanes: CalendarDayLane[];
  buckets: Record<string, FiBookingRow[]>;
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  userAssignees?: CrmShellUserPickerOption[];
  services?: FiServiceRow[];
  onSelectBooking: (b: FiBookingRow) => void;
  onEmptySlot: (dayKey: string, hour: number) => void;
}) {
  if (view === "day" && lanes[0]) {
    const lane = lanes[0];
    return (
      <BookingCalendarDayView
        lane={lane}
        events={buckets[lane.dayKey] ?? []}
        clinicalStaffOptions={clinicalStaffOptions}
        userAssignees={userAssignees}
        services={services}
        onSelectBooking={onSelectBooking}
        onEmptySlot={onEmptySlot}
      />
    );
  }
  return (
    <BookingCalendarWeekView
      lanes={lanes}
      buckets={buckets}
      clinicalStaffOptions={clinicalStaffOptions}
      userAssignees={userAssignees}
      services={services}
      onSelectBooking={onSelectBooking}
      onEmptySlot={onEmptySlot}
    />
  );
}
