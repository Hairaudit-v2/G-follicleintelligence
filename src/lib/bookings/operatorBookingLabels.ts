/**
 * Staff-facing labels for booking operator UI (Stage 3B). Pure.
 */

import {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  isAllowedBookingStatus,
  isAllowedBookingType,
} from "./bookingPolicy";

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation",
  hair_transplant_consultation: "Hair transplant consultation",
  trichology: "Trichology",
  beard_transplant_consultation: "Beard transplant consultation",
  eyebrow_transplant_consultation: "Eyebrow transplant consultation",
  prp: "PRP",
  prf: "PRF",
  mesotherapy: "Mesotherapy",
  exosomes: "Exosomes",
  surgery: "Hair Transplant",
  review: "Review",
  follow_up: "Follow-up",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Human-readable booking type for tables and badges. */
export function bookingTypeLabel(type: string): string {
  const t = type.trim();
  if (!isAllowedBookingType(t)) return t || "Unknown";
  return TYPE_LABELS[t] ?? t;
}

/** Human-readable booking status for tables and badges. */
export function bookingStatusLabel(status: string): string {
  const s = status.trim();
  if (!isAllowedBookingStatus(s)) return s || "Unknown";
  return STATUS_LABELS[s] ?? s;
}

export function allBookingTypeOptions(): { value: string; label: string }[] {
  return [...BOOKING_TYPES].map((value) => ({ value, label: bookingTypeLabel(value) }));
}

export function allBookingStatusOptions(): { value: string; label: string }[] {
  return [...BOOKING_STATUSES].map((value) => ({ value, label: bookingStatusLabel(value) }));
}
