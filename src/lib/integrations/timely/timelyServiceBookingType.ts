import { assertAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";

export type TimelyServiceBookingTypeInput = {
  name: string;
  category: string | null;
  booking_type: string | null;
};

/** Exact service names (case-insensitive) → booking_type when `fi_services.booking_type` is null. */
const CONSULTATION_SERVICE_NAME_TO_BOOKING_TYPE: Readonly<Record<string, string>> = {
  "hair transplant consultation": "hair_transplant_consultation",
  "in-clinic consultation": "consultation",
  "phone consultation": "consultation",
  "trichology consultation": "trichology",
  "beard transplant consultation": "beard_transplant_consultation",
  "eyebrow transplant consultation": "eyebrow_transplant_consultation",
  "follow-up review": "follow_up",
  "surgery review": "review",
};

function normalizeServiceName(name: string): string {
  return name.trim().toLowerCase();
}

function isConsultationCategory(category: string | null | undefined): boolean {
  return category?.trim().toLowerCase() === "consultation";
}

/**
 * Resolve the FI booking_type for a Timely appointment from the matched service row.
 * Uses explicit `booking_type` when set; otherwise derives from service name / category.
 */
export function deriveTimelyServiceBookingType(service: TimelyServiceBookingTypeInput): string {
  const explicit = service.booking_type?.trim();
  if (explicit) {
    assertAllowedBookingType(explicit);
    return explicit;
  }

  const fromName = CONSULTATION_SERVICE_NAME_TO_BOOKING_TYPE[normalizeServiceName(service.name)];
  if (fromName) {
    assertAllowedBookingType(fromName);
    return fromName;
  }

  if (isConsultationCategory(service.category)) {
    return "consultation";
  }

  throw new Error(`Cannot derive booking_type for service: ${service.name.trim()}`);
}
