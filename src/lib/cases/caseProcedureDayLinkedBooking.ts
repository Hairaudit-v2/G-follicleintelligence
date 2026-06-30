import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "@/src/lib/bookings/types";

function isCancelledBooking(b: FiBookingRow): boolean {
  const st = b.booking_status.trim().toLowerCase();
  return st === "cancelled" || Boolean(b.cancelled_at?.trim());
}

/**
 * Earliest non-cancelled surgery booking linked on the case (by `start_at`), for procedure-day alignment.
 */
export function pickPrimaryLinkedSurgeryBookingYmd(
  bookings: FiBookingRow[],
  calendarTimezone: string
): { ymd: string | null; bookingId: string | null } {
  const surgery = bookings.filter(
    (b) => b.booking_type.trim().toLowerCase() === "surgery" && !isCancelledBooking(b)
  );
  if (!surgery.length) return { ymd: null, bookingId: null };
  surgery.sort((a, b) => a.start_at.localeCompare(b.start_at));
  const b = surgery[0]!;
  const tz = calendarTimezone.trim();
  return {
    ymd: calendarDateStringFromInstant(new Date(b.start_at), tz),
    bookingId: b.id,
  };
}
