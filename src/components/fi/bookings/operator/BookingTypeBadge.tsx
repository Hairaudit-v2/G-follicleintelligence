import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";

export function BookingTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900">
      {bookingTypeLabel(type)}
    </span>
  );
}
