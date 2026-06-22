"use client";

import { useMemo, useRef } from "react";

import { calendarBookingsHydrationFingerprint } from "@/src/lib/calendar/calendarHydrationFingerprint";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type StableCalendarBookings = {
  rows: FiBookingRow[];
  /** Changes when visible booking payload changes (ids, times, status). */
  fingerprint: string;
};

/**
 * Keep booking row array identity stable when RSC re-sends the same payload with a new reference.
 * Avoids `useMemo(() => bookings, [fingerprint])` exhaustive-deps false positives.
 */
export function useBookingsStableByFingerprint(bookings: FiBookingRow[]): StableCalendarBookings {
  const fingerprint = useMemo(() => calendarBookingsHydrationFingerprint(bookings), [bookings]);
  const cached = useRef<StableCalendarBookings>({
    fingerprint,
    rows: bookings,
  });

  if (cached.current.fingerprint !== fingerprint) {
    cached.current = { fingerprint, rows: bookings };
  }

  return cached.current;
}
