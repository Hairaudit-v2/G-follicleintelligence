"use client";

import { cn } from "@/lib/utils";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingCalendarChipSurface, bookingTypeCalendarLegendLabel } from "@/src/lib/bookings/calendarLabels";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import { formatTimeRangeInTimezone, normalizeCalendarTimezone } from "@/src/lib/calendar/calendarTimezone";

export function BookingCalendarEventCard({
  booking,
  clinicalStaffOptions,
  userAssignees = [],
  layout,
  onClick,
  calendarTimezone,
  services = [],
}: {
  booking: FiBookingRow;
  clinicalStaffOptions: ClinicalStaffPickerOption[];
  userAssignees?: CrmShellUserPickerOption[];
  layout: { topPx: number; heightPx: number };
  onClick: () => void;
  calendarTimezone?: string | null;
  services?: FiServiceRow[];
}) {
  const cat = serviceForBookingType(services, booking.booking_type);
  const chip = bookingCalendarChipSurface(booking.booking_type, cat?.color ?? null);
  const typeLabel = cat?.name?.trim() || bookingTypeCalendarLegendLabel(booking.booking_type);
  const tz = normalizeCalendarTimezone(calendarTimezone ?? booking.timezone);
  const range = formatTimeRangeInTimezone(booking.start_at, booking.end_at, tz);
  const assignment = bookingAssignmentDisplay(clinicalStaffOptions, userAssignees, booking);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute left-1 right-1 z-[1] overflow-hidden rounded border px-1.5 py-1 text-left text-xs shadow-sm transition hover:z-[2] hover:brightness-110",
        chip.toneClasses
      )}
      style={{ top: layout.topPx, height: layout.heightPx, ...chip.chipStyle }}
    >
      <div className="truncate font-medium leading-tight">{booking.title?.trim() || "Booking"}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide opacity-90">{typeLabel}</span>
        <BookingStatusBadge status={booking.booking_status} />
      </div>
      <div className="mt-0.5 truncate text-[10px] opacity-90">{range}</div>
      <div className="truncate text-[10px] opacity-90">{assignment.summaryLine}</div>
    </button>
  );
}
