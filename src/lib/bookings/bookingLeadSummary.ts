/**
 * Lead ↔ booking summaries for CRM overview, next-action, and create prefill.
 */

import { bookingTypeLabel } from "./operatorBookingLabels";
import { isBookingUpcoming, sortBookingsByStartAt } from "./bookingTime";
import type { BookingType } from "./bookingPolicy";
import type { FiBookingRow } from "./types";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";

function isTerminalBooking(row: FiBookingRow): boolean {
  return row.booking_status === "cancelled" || row.booking_status === "completed";
}

/** Non-cancelled, non-completed bookings with `start_at` on or after `now`. */
export function filterUpcomingLeadBookings(
  bookings: FiBookingRow[],
  now: Date = new Date()
): FiBookingRow[] {
  return sortBookingsByStartAt(bookings).filter((b) => {
    if (isTerminalBooking(b)) return false;
    return isBookingUpcoming(b, now);
  });
}

/** Soonest upcoming booking for a lead, if any. */
export function pickNextUpcomingLeadBooking(
  bookings: FiBookingRow[],
  now: Date = new Date()
): FiBookingRow | null {
  return filterUpcomingLeadBookings(bookings, now)[0] ?? null;
}

export function formatUpcomingBookingLabel(booking: FiBookingRow): string {
  const type = bookingTypeLabel(booking.booking_type);
  const when = new Date(booking.start_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const title = booking.title?.trim();
  return title ? `${type} · ${title} · ${when}` : `${type} · ${when}`;
}

export type RecommendedBookingTypeResult = {
  bookingType: BookingType;
  reason: string;
};

/**
 * Suggest the next appointment type to book for this lead (Evolved Hair Clinics funnel).
 */
export function deriveRecommendedBookingTypeForLead(opts: {
  lead: FiCrmLeadRow;
  bookings: FiBookingRow[];
}): RecommendedBookingTypeResult {
  const sorted = sortBookingsByStartAt(opts.bookings);
  const completed = sorted.filter((b) => b.booking_status === "completed");
  const hasPatient = Boolean(opts.lead.patient_id?.trim());

  if (!hasPatient) {
    return {
      bookingType: "consultation",
      reason: "Link a patient via conversion before non-consultation visits.",
    };
  }

  const completedTypes = new Set(completed.map((b) => b.booking_type.trim()));
  const lastCompleted = completed[completed.length - 1];

  if (completed.length === 0) {
    return { bookingType: "consultation", reason: "No prior visits — start with a consultation." };
  }

  if (!completedTypes.has("consultation")) {
    return { bookingType: "consultation", reason: "No completed consultation on file yet." };
  }

  if (!completedTypes.has("surgery") && lastCompleted?.booking_type.trim() === "consultation") {
    return {
      bookingType: "surgery",
      reason: "Consultation completed — typical next step is procedure day.",
    };
  }

  if (completedTypes.has("surgery")) {
    return { bookingType: "follow_up", reason: "Post-procedure follow-up or review." };
  }

  return { bookingType: "review", reason: "Ongoing care — schedule a review visit." };
}
