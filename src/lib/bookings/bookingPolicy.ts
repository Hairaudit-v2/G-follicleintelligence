/**
 * Pure booking policy guards (Stage 3A).
 */

import type { FiBookingRow } from "./types";

export const BOOKING_TYPES = [
  "consultation",
  "prp",
  "prf",
  "mesotherapy",
  "exosomes",
  "surgery",
  "review",
  "follow_up",
  "other",
] as const;

export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_STATUSES = [
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TYPE_SET = new Set<string>(BOOKING_TYPES);
const STATUS_SET = new Set<string>(BOOKING_STATUSES);

export function isAllowedBookingType(v: string): boolean {
  return TYPE_SET.has(v.trim());
}

export function isAllowedBookingStatus(v: string): boolean {
  return STATUS_SET.has(v.trim());
}

export function assertAllowedBookingType(v: string): void {
  const t = v.trim();
  if (!isAllowedBookingType(t)) throw new Error(`Invalid booking_type: ${v}.`);
}

export function assertAllowedBookingStatus(v: string): void {
  const s = v.trim();
  if (!isAllowedBookingStatus(s)) throw new Error(`Invalid booking_status: ${v}.`);
}

export function assertAtLeastOneBookingAnchor(input: {
  lead_id?: string | null;
  person_id?: string | null;
  patient_id?: string | null;
  case_id?: string | null;
}): void {
  const has =
    nonEmpty(input.lead_id) ||
    nonEmpty(input.person_id) ||
    nonEmpty(input.patient_id) ||
    nonEmpty(input.case_id);
  if (!has) {
    throw new Error("Booking must link to at least one of lead_id, person_id, patient_id, or case_id.");
  }
}

function nonEmpty(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim());
}

export function assertEndAfterStart(startAtIso: string, endAtIso: string): void {
  const a = Date.parse(startAtIso.trim());
  const b = Date.parse(endAtIso.trim());
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Invalid start_at or end_at.");
  if (b <= a) throw new Error("end_at must be after start_at.");
}

export function assertMetadataJsonObject(metadata: unknown): asserts metadata is Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("metadata must be a JSON object.");
  }
}

/**
 * When a lead is not yet converted, only consultation bookings may target that lead alone.
 * Receptionist quick-book flows that also anchor `patient_id` may schedule any procedure type.
 */
export function assertBookingTypeAllowedForLeadConversion(opts: {
  bookingType: string;
  leadId: string | null | undefined;
  leadConverted: boolean;
  patientId?: string | null | undefined;
}): void {
  assertAllowedBookingType(opts.bookingType);
  if (!nonEmpty(opts.leadId)) return;
  if (opts.leadConverted) return;
  if (nonEmpty(opts.patientId)) return;
  if (opts.bookingType.trim() !== "consultation") {
    throw new Error("Only consultation bookings are allowed before the lead is converted.");
  }
}

export function isBookingCancelled(row: Pick<FiBookingRow, "booking_status" | "cancelled_at">): boolean {
  return row.booking_status.trim() === "cancelled" || Boolean(row.cancelled_at?.trim());
}

/**
 * Cancelled rows reject general edits (Stage 3A). Cancellation metadata is set only via `cancelBooking`.
 */
export function assertNonCancelledBookingMutable(row: Pick<FiBookingRow, "booking_status" | "cancelled_at">): void {
  if (isBookingCancelled(row)) throw new Error("Cancelled bookings cannot be edited.");
}

export function isBookingRowForTenant(row: Pick<FiBookingRow, "tenant_id">, tenantId: string): boolean {
  return row.tenant_id.trim() === tenantId.trim();
}
