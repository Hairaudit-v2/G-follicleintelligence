/**
 * Booking time helpers (Stage 3A). Pure.
 */

import type { FiBookingRow } from "./types";

/** Ascending by `start_at` (stable tie-break on `id`). */
export function sortBookingsByStartAt(bookings: FiBookingRow[]): FiBookingRow[] {
  return [...bookings].sort((a, b) => {
    const cmp = a.start_at.localeCompare(b.start_at);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
}

export function isBookingUpcoming(row: FiBookingRow, now: Date): boolean {
  const t = Date.parse(row.start_at);
  if (!Number.isFinite(t)) return false;
  return t >= now.getTime();
}
