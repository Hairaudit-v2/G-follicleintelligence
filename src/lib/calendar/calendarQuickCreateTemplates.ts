import type { BookingType } from "@/src/lib/bookings/bookingPolicy";

export type CalendarQuickTemplateId =
  | "consultation_30"
  | "trichology_consultation_60"
  | "hair_transplant_consultation_45"
  | "prp_treatment_30"
  | "exosome_treatment_30"
  | "follow_up_15"
  | "surgery_review_20"
  | "surgery_default"
  | "block_time";

export type CalendarQuickTemplate = {
  id: CalendarQuickTemplateId;
  label: string;
  /** Stored `fi_bookings.booking_type` — must be an allowed platform type. */
  bookingType: BookingType;
  durationMinutes: number;
  /** Preferred card title; falls back to label. */
  title: string;
  /** When true, server uses calendar-hold anchor flow. */
  isBlock?: boolean;
};

export const CALENDAR_QUICK_TEMPLATES: CalendarQuickTemplate[] = [
  {
    id: "consultation_30",
    label: "Consultation",
    bookingType: "consultation",
    durationMinutes: 30,
    title: "Consultation",
  },
  {
    id: "trichology_consultation_60",
    label: "Trichology Consultation",
    bookingType: "consultation",
    durationMinutes: 60,
    title: "Trichology Consultation",
  },
  {
    id: "hair_transplant_consultation_45",
    label: "Hair Transplant Consultation",
    bookingType: "consultation",
    durationMinutes: 45,
    title: "Hair Transplant Consultation",
  },
  {
    id: "prp_treatment_30",
    label: "PRP Treatment",
    bookingType: "prp",
    durationMinutes: 30,
    title: "PRP Treatment",
  },
  {
    id: "exosome_treatment_30",
    label: "Exosome Treatment",
    bookingType: "exosomes",
    durationMinutes: 30,
    title: "Exosome Treatment",
  },
  {
    id: "follow_up_15",
    label: "Follow Up",
    bookingType: "follow_up",
    durationMinutes: 15,
    title: "Follow Up",
  },
  {
    id: "surgery_review_20",
    label: "Surgery Review",
    bookingType: "review",
    durationMinutes: 20,
    title: "Surgery Review",
  },
  {
    id: "surgery_default",
    label: "Surgery",
    bookingType: "surgery",
    durationMinutes: 120,
    title: "Surgery",
  },
  {
    id: "block_time",
    label: "Block time",
    bookingType: "other",
    durationMinutes: 30,
    title: "Blocked",
    isBlock: true,
  },
];

export function calendarQuickTemplateById(id: CalendarQuickTemplateId): CalendarQuickTemplate | undefined {
  return CALENDAR_QUICK_TEMPLATES.find((t) => t.id === id);
}
