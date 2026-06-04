"use client";

import { cn } from "@/lib/utils";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { bookingTypeCalendarEventClasses, bookingTypeCalendarLegendLabel } from "@/src/lib/bookings/calendarLabels";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "Unassigned";
  const o = options.find((x) => x.id === id);
  return o?.email?.trim() || o?.id.slice(0, 8) || id.slice(0, 8);
}

export function BookingCalendarEventCard({
  booking,
  assignees,
  layout,
  onClick,
}: {
  booking: FiBookingRow;
  assignees: CrmShellUserPickerOption[];
  layout: { topPx: number; heightPx: number };
  onClick: () => void;
}) {
  const tone = bookingTypeCalendarEventClasses(booking.booking_type);
  const range = `${new Date(booking.start_at).toLocaleTimeString(undefined, { timeStyle: "short" })}–${new Date(
    booking.end_at
  ).toLocaleTimeString(undefined, { timeStyle: "short" })}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute left-1 right-1 z-[1] overflow-hidden rounded border px-1.5 py-1 text-left text-xs shadow-sm transition hover:z-[2] hover:brightness-110",
        tone
      )}
      style={{ top: layout.topPx, height: layout.heightPx }}
    >
      <div className="truncate font-medium leading-tight">{booking.title?.trim() || "Booking"}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide opacity-90">
          {bookingTypeCalendarLegendLabel(booking.booking_type)}
        </span>
        <BookingStatusBadge status={booking.booking_status} />
      </div>
      <div className="mt-0.5 truncate text-[10px] opacity-90">{range}</div>
      <div className="truncate text-[10px] opacity-90">{assigneeLabel(assignees, booking.assigned_user_id)}</div>
    </button>
  );
}
