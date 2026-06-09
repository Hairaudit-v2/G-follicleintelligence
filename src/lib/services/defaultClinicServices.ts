import type { BookingType } from "@/src/lib/bookings/bookingPolicy";
import type { FiServiceApprovedImportRow } from "@/src/lib/timelyImport/buildApprovedFiSeed";

/** Stable Evolved Hair Clinics default procedure catalog (Stage 2F). */
export type DefaultClinicServiceDefinition = {
  name: string;
  category: string;
  booking_type: BookingType | null;
  duration_minutes: number;
  base_price: number;
  color: string;
};

const CONSULT = "#2563eb";
const TREAT = "#059669";
const SURGERY = "#dc2626";
const FOLLOW = "#7c3aed";
const OTHER = "#64748b";

/**
 * Seventeen default clinic services. At most one row per non-null `booking_type` (DB unique index).
 * Additional consultation / surgery variants use `booking_type: null` and match by name + category on seed.
 */
export const DEFAULT_CLINIC_SERVICE_LIBRARY: readonly DefaultClinicServiceDefinition[] = [
  {
    name: "Phone Consultation",
    category: "Consultation",
    booking_type: null,
    duration_minutes: 30,
    base_price: 0,
    color: CONSULT,
  },
  {
    name: "In-Clinic Consultation",
    category: "Consultation",
    booking_type: "consultation",
    duration_minutes: 45,
    base_price: 0,
    color: CONSULT,
  },
  {
    name: "Trichology Consultation",
    category: "Consultation",
    booking_type: null,
    duration_minutes: 60,
    base_price: 120,
    color: CONSULT,
  },
  {
    name: "Hair Transplant Consultation",
    category: "Consultation",
    booking_type: null,
    duration_minutes: 60,
    base_price: 0,
    color: CONSULT,
  },
  {
    name: "PRP Treatment",
    category: "Treatment",
    booking_type: "prp",
    duration_minutes: 60,
    base_price: 320,
    color: TREAT,
  },
  {
    name: "PRF Treatment",
    category: "Treatment",
    booking_type: "prf",
    duration_minutes: 60,
    base_price: 350,
    color: TREAT,
  },
  {
    name: "Exosomes Treatment",
    category: "Treatment",
    booking_type: "exosomes",
    duration_minutes: 45,
    base_price: 450,
    color: TREAT,
  },
  {
    name: "Meso Therapy",
    category: "Treatment",
    booking_type: "mesotherapy",
    duration_minutes: 45,
    base_price: 320,
    color: TREAT,
  },
  {
    name: "Follow-Up Review",
    category: "Follow-up",
    booking_type: "follow_up",
    duration_minutes: 30,
    base_price: 0,
    color: FOLLOW,
  },
  {
    name: "Surgery Review",
    category: "Follow-up",
    booking_type: "review",
    duration_minutes: 30,
    base_price: 0,
    color: FOLLOW,
  },
  {
    name: "Hair Transplant Surgery - One Day",
    category: "Surgery",
    booking_type: "surgery",
    duration_minutes: 480,
    base_price: 11_000,
    color: SURGERY,
  },
  {
    name: "Hair Transplant Surgery - Two Day",
    category: "Surgery",
    booking_type: null,
    duration_minutes: 960,
    base_price: 15_000,
    color: SURGERY,
  },
  {
    name: "Beard Transplant Consultation",
    category: "Consultation",
    booking_type: null,
    duration_minutes: 45,
    base_price: 0,
    color: CONSULT,
  },
  {
    name: "Eyebrow Transplant Consultation",
    category: "Consultation",
    booking_type: null,
    duration_minutes: 45,
    base_price: 0,
    color: CONSULT,
  },
  {
    name: "Beard Transplant Surgery",
    category: "Surgery",
    booking_type: null,
    duration_minutes: 480,
    base_price: 10_000,
    color: SURGERY,
  },
  {
    name: "Eyebrow Transplant Surgery",
    category: "Surgery",
    booking_type: null,
    duration_minutes: 300,
    base_price: 5_500,
    color: SURGERY,
  },
  {
    name: "Block Time / Admin Hold",
    category: "Other",
    booking_type: "other",
    duration_minutes: 30,
    base_price: 0,
    color: OTHER,
  },
] as const;

export function defaultClinicServicesAsImportRows(): FiServiceApprovedImportRow[] {
  return DEFAULT_CLINIC_SERVICE_LIBRARY.map((row) => ({
    name: row.name,
    category: row.category,
    booking_type: row.booking_type,
    duration_minutes: row.duration_minutes,
    base_price: row.base_price,
    color: row.color,
    is_active: true,
    review_flags: [],
  }));
}
