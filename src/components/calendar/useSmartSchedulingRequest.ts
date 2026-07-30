"use client";

import { useMemo } from "react";

import { fromDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import type { SmartSchedulingRequest } from "@/src/components/calendar/SmartSchedulingAssistant";

/**
 * Build a live Smart Scheduling request from datetime-local form fields.
 * Returns null until start/end parse cleanly.
 */
export function useSmartSchedulingRequest(opts: {
  /** When false, never evaluate (e.g. cancelled booking). */
  enabled?: boolean;
  startLocal: string;
  endLocal: string;
  /** IANA zone for wall-clock interpretation. */
  timeZone?: string | null;
  clinicId?: string | null;
  bookingType?: string | null;
  staffId?: string | null;
  staffLabel?: string | null;
  roomId?: string | null;
  roomRequired?: boolean;
  patientId?: string | null;
  bookingId?: string | null;
  includeSuggestions?: boolean;
}): SmartSchedulingRequest | null {
  const {
    enabled = true,
    startLocal,
    endLocal,
    timeZone,
    clinicId,
    bookingType,
    staffId,
    staffLabel,
    roomId,
    roomRequired,
    patientId,
    bookingId,
    includeSuggestions = true,
  } = opts;

  return useMemo(() => {
    if (!enabled) return null;
    const startAt = fromDatetimeLocalValue(startLocal, timeZone ?? null);
    const endAt = fromDatetimeLocalValue(endLocal, timeZone ?? null);
    if (!startAt || !endAt) return null;
    return {
      clinicId: clinicId?.trim() || null,
      bookingType: bookingType?.trim() || null,
      roomId: roomId?.trim() || null,
      roomRequired,
      staffId: staffId?.trim() || null,
      staffLabel: staffLabel?.trim() || null,
      patientId: patientId?.trim() || null,
      bookingId: bookingId?.trim() || null,
      startAt,
      endAt,
      includeSuggestions,
    };
  }, [
    bookingId,
    bookingType,
    clinicId,
    enabled,
    endLocal,
    includeSuggestions,
    patientId,
    roomId,
    roomRequired,
    staffId,
    staffLabel,
    startLocal,
    timeZone,
  ]);
}
