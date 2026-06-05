/**
 * Procedure duration / end-time helpers backed by `fi_services` when available,
 * with conservative fallbacks when the catalog is empty or a type has no row.
 */

import { BOOKING_TYPES, type BookingType } from "./bookingPolicy";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

/** Last-resort minutes per canonical `booking_type` when no `fi_services` row exists. */
export const FALLBACK_PROCEDURE_DURATION_MINUTES: Record<BookingType, number> = {
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

/** Active rows with a `booking_type` — preferred for selectors and duration lookup. */
export function activeBookableServices(services: FiServiceRow[]): FiServiceRow[] {
  return services.filter((s) => s.is_active && s.booking_type?.trim());
}

export function servicesByBookingType(services: FiServiceRow[]): Map<string, FiServiceRow> {
  const m = new Map<string, FiServiceRow>();
  for (const s of services) {
    const bt = s.booking_type?.trim();
    if (!bt) continue;
    if (!s.is_active) continue;
    m.set(bt, s);
  }
  return m;
}

export function serviceForBookingType(services: FiServiceRow[], bookingType: string): FiServiceRow | null {
  return servicesByBookingType(services).get(bookingType.trim()) ?? null;
}

export function defaultProcedureDurationMinutes(
  procedure: string,
  services?: FiServiceRow[] | Map<string, FiServiceRow> | null
): number {
  const key = procedure.trim();
  const map = services == null ? null : services instanceof Map ? services : servicesByBookingType(services);
  const row = map?.get(key);
  if (row && row.duration_minutes > 0) return row.duration_minutes;
  const bt = key as BookingType;
  return FALLBACK_PROCEDURE_DURATION_MINUTES[bt] ?? 30;
}

export function endIsoFromStartAndProcedure(
  startAtIso: string,
  procedure: string,
  services?: FiServiceRow[] | Map<string, FiServiceRow> | null
): string {
  const startMs = Date.parse(startAtIso);
  if (!Number.isFinite(startMs)) throw new Error("Invalid startAt.");
  const minutes = defaultProcedureDurationMinutes(procedure, services);
  return new Date(startMs + minutes * 60_000).toISOString();
}

export function formatPriceAud(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}
