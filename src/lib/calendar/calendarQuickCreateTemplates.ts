import type { BookingType } from "@/src/lib/bookings/bookingPolicy";

/** Stage 2A — receptionist quick-book appointment types. */
export type CalendarQuickTemplateId =
  | "phone_consult"
  | "consultation"
  | "prp"
  | "exosomes"
  | "follow_up"
  | "surgery_review"
  | "surgery";

export type CalendarQuickTemplate = {
  id: CalendarQuickTemplateId;
  label: string;
  /** Stored `fi_bookings.booking_type` — must be an allowed platform type. */
  bookingType: BookingType;
  /** Preferred `fi_services.name` when resolving duration from the tenant catalog. */
  catalogName?: string;
  catalogCategory?: string;
  durationMinutes: number;
  /** Preferred card title; falls back to label. */
  title: string;
};

/** Primary quick-book types shown as large buttons in the drawer. */
export const CALENDAR_QUICK_TEMPLATES: CalendarQuickTemplate[] = [
  {
    id: "phone_consult",
    label: "Phone Consultation",
    bookingType: "consultation",
    catalogName: "Phone Consultation",
    catalogCategory: "Consultation",
    durationMinutes: 30,
    title: "Phone Consultation",
  },
  {
    id: "consultation",
    label: "Consultation",
    bookingType: "consultation",
    catalogName: "In-Clinic Consultation",
    catalogCategory: "Consultation",
    durationMinutes: 45,
    title: "Consultation",
  },
  {
    id: "prp",
    label: "PRP",
    bookingType: "prp",
    catalogName: "PRP Treatment",
    catalogCategory: "Treatment",
    durationMinutes: 60,
    title: "PRP",
  },
  {
    id: "exosomes",
    label: "Exosomes",
    bookingType: "exosomes",
    catalogName: "Exosomes Treatment",
    catalogCategory: "Treatment",
    durationMinutes: 45,
    title: "Exosomes",
  },
  {
    id: "follow_up",
    label: "Follow Up",
    bookingType: "follow_up",
    catalogName: "Follow-Up Review",
    catalogCategory: "Follow-up",
    durationMinutes: 30,
    title: "Follow Up",
  },
  {
    id: "surgery_review",
    label: "Surgery Review",
    bookingType: "review",
    catalogName: "Surgery Review",
    catalogCategory: "Follow-up",
    durationMinutes: 30,
    title: "Surgery Review",
  },
  {
    id: "surgery",
    label: "Surgery",
    bookingType: "surgery",
    catalogName: "Hair Transplant Surgery - One Day",
    catalogCategory: "Surgery",
    durationMinutes: 480,
    title: "Surgery",
  },
];

export function calendarQuickTemplateById(
  id: CalendarQuickTemplateId
): CalendarQuickTemplate | undefined {
  return CALENDAR_QUICK_TEMPLATES.find((t) => t.id === id);
}
