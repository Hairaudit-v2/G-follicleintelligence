/**
 * Patient ↔ booking summaries for profile shortcuts and create prefill.
 */

import { bookingTypeLabel } from "./operatorBookingLabels";
import { sortBookingsByStartAt } from "./bookingTime";
import type { FiBookingRow } from "./types";
import {
  deriveRecommendedBookingTypeForLead,
  filterUpcomingLeadBookings,
  formatUpcomingBookingLabel,
  pickNextUpcomingLeadBooking,
  type RecommendedBookingTypeResult,
} from "./bookingLeadSummary";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";

export { formatUpcomingBookingLabel, pickNextUpcomingLeadBooking, filterUpcomingLeadBookings };

function completedTypes(bookings: FiBookingRow[]): Set<string> {
  return new Set(
    sortBookingsByStartAt(bookings)
      .filter((b) => b.booking_status === "completed")
      .map((b) => b.booking_type.trim())
  );
}

/**
 * Suggest the next appointment type for a foundation patient (uses primary lead funnel when present).
 */
export function deriveRecommendedBookingTypeForPatient(opts: {
  bookings: FiBookingRow[];
  primaryLead?: FiCrmLeadRow | null;
}): RecommendedBookingTypeResult {
  if (opts.primaryLead) {
    return deriveRecommendedBookingTypeForLead({ lead: opts.primaryLead, bookings: opts.bookings });
  }

  const sorted = sortBookingsByStartAt(opts.bookings);
  const completed = sorted.filter((b) => b.booking_status === "completed");
  const types = completedTypes(opts.bookings);

  if (completed.length === 0) {
    return { bookingType: "consultation", reason: "No prior visits — start with a consultation." };
  }

  if (!types.has("consultation")) {
    return { bookingType: "consultation", reason: "No completed consultation on file yet." };
  }

  const lastCompleted = completed[completed.length - 1];
  if (!types.has("surgery") && lastCompleted?.booking_type.trim() === "consultation") {
    return {
      bookingType: "surgery",
      reason: "Consultation completed — typical next step is procedure day.",
    };
  }

  if (types.has("surgery")) {
    return { bookingType: "follow_up", reason: "Post-procedure follow-up or review." };
  }

  return { bookingType: "review", reason: "Ongoing care — schedule a review visit." };
}

export function buildPatientBookingTitle(bookingType: string, displayName?: string | null): string {
  const label = bookingTypeLabel(bookingType);
  const name = displayName?.trim();
  return name ? `${label} — ${name}` : label;
}

export function filterUpcomingPatientBookings(
  bookings: FiBookingRow[],
  now: Date = new Date()
): FiBookingRow[] {
  return filterUpcomingLeadBookings(bookings, now);
}

export function pickNextUpcomingPatientBooking(
  bookings: FiBookingRow[],
  now: Date = new Date()
): FiBookingRow | null {
  return pickNextUpcomingLeadBooking(bookings, now);
}
