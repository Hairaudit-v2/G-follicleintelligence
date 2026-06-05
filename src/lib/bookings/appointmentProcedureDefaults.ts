/**
 * Default slot lengths for Evolved Hair Clinics procedures (calendar API).
 * Used when POST /appointments omits `endAt`.
 */

import type { BookingType } from "./bookingPolicy";

/** Minutes per canonical booking type for calendar scheduling. */
export const DEFAULT_PROCEDURE_DURATION_MINUTES: Record<BookingType, number> = {
  consultation: 45,
  prp: 60,
  prf: 60,
  mesotherapy: 45,
  exosomes: 45,
  surgery: 480,
  review: 30,
  follow_up: 30,
  other: 30,
};

export function defaultProcedureDurationMinutes(procedure: string): number {
  const key = procedure.trim() as BookingType;
  return DEFAULT_PROCEDURE_DURATION_MINUTES[key] ?? 30;
}

export function endIsoFromStartAndProcedure(startAtIso: string, procedure: string): string {
  const startMs = Date.parse(startAtIso);
  if (!Number.isFinite(startMs)) throw new Error("Invalid startAt.");
  const minutes = defaultProcedureDurationMinutes(procedure);
  return new Date(startMs + minutes * 60_000).toISOString();
}
