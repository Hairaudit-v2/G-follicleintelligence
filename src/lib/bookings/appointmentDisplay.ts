import { bookingTypeLabel } from "./operatorBookingLabels";
import type { FiBookingRow } from "./types";

export function appointmentTitleFromBooking(booking: Pick<FiBookingRow, "title" | "booking_type" | "id">): string {
  const t = booking.title?.trim();
  if (t) return t;
  return `${bookingTypeLabel(booking.booking_type)} · ${booking.id.slice(0, 8)}`;
}
