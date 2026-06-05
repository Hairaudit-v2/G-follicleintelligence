/**
 * Summary tiles for booking operator page (Stage 3B). Pure.
 */

import { isBookingCancelled } from "./bookingPolicy";
import type { FiBookingRow } from "./types";

const INCOMPLETE_ACTIVE = new Set(["scheduled", "confirmed", "arrived", "no_show"]);

/** Mirrors `loadBookingsForOperatorView` cancelled visibility (pure; for tests / UI). */
export function filterOperatorBookingsByCancelledPolicy(
  rows: FiBookingRow[],
  includeCancelled: boolean
): FiBookingRow[] {
  if (includeCancelled) return [...rows];
  return rows.filter((b) => !isBookingCancelled(b));
}

export type OperatorBookingSummaryCounts = {
  /** Bookings whose `start_at` falls in `[dayStartMs, dayEndMs)` (any status). */
  today: number;
  /** Non-terminal rows with `start_at >= nowMs`. */
  upcoming: number;
  /** Incomplete rows with `start_at < nowMs` (not completed / not cancelled). */
  overdue: number;
  cancelled: number;
  completed: number;
};

/**
 * @param dayStartMs / dayEndMs — UTC instants bounding “today” for the summary strip (clinic-local midnight → next midnight when tenant timezone is loaded).
 */
export function computeOperatorBookingSummaryCounts(
  rows: FiBookingRow[],
  opts: { nowMs: number; dayStartMs: number; dayEndMs: number }
): OperatorBookingSummaryCounts {
  let today = 0;
  let upcoming = 0;
  let overdue = 0;
  let cancelled = 0;
  let completed = 0;

  for (const b of rows) {
    const startMs = Date.parse(b.start_at);
    if (!Number.isFinite(startMs)) continue;

    if (startMs >= opts.dayStartMs && startMs < opts.dayEndMs) {
      today += 1;
    }

    if (isBookingCancelled(b)) {
      cancelled += 1;
      continue;
    }

    if (b.booking_status === "completed") {
      completed += 1;
      continue;
    }

    if (startMs >= opts.nowMs) {
      upcoming += 1;
    } else if (INCOMPLETE_ACTIVE.has(b.booking_status.trim())) {
      overdue += 1;
    }
  }

  return { today, upcoming, overdue, cancelled, completed };
}
