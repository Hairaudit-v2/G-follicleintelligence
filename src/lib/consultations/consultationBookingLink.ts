import type { ConsultationTypeId } from "./consultationTypeConfig";
import { DEFAULT_CONSULTATION_TYPE_ID } from "./consultationTypeConfig";

/** Booking types that should auto-provision a ConsultationOS workspace from calendar bookings. */
export const CONSULTATION_LIKE_BOOKING_TYPES = [
  "consultation",
  "trichology",
  "hair_transplant_consultation",
  "review_consultation",
  "follow_up_consultation",
] as const;

const CONSULTATION_LIKE_BOOKING_TYPE_SET = new Set<string>(CONSULTATION_LIKE_BOOKING_TYPES);

export function isConsultationLikeBookingType(bookingType: string): boolean {
  return CONSULTATION_LIKE_BOOKING_TYPE_SET.has(bookingType.trim().toLowerCase());
}

/** Map operational booking types to ConsultationOS consultation types. */
export function consultationTypeForBookingType(bookingType: string): ConsultationTypeId {
  const t = bookingType.trim().toLowerCase();
  if (t === "prp") return "prp_prf";
  if (t === "exosomes") return "exosomes";
  if (t === "mesotherapy") return "mesotherapy";
  return DEFAULT_CONSULTATION_TYPE_ID;
}
