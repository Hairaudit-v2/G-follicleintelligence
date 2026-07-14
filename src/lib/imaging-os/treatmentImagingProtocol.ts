/**
 * FI-TREATMENT-IMAGING-PROTOCOL-1 — standardised scalp imaging for in-clinic
 * regenerative treatment bookings (PRP, mesotherapy, dutasteride mesotherapy, exosomes).
 */

import { isConsultationLikeBookingType } from "@/src/lib/consultations/consultationBookingLink";
import {
  missingRequiredSlotSlugs,
  protocolRequiredCompletionPercent,
  slotIsSatisfied,
  type ProtocolSlotDef,
} from "@/src/lib/imagingOs/imagingOsProtocol";
import { getVieProtocolOrThrow } from "@/src/lib/vie/vieProtocolCatalog";
import type { VieProtocolSlotDef } from "@/src/lib/vie/vieProtocolTypes";

export const TREATMENT_IMAGING_PROTOCOL_SLUG = "treatment_scalp_standard" as const;
export const TREATMENT_IMAGING_CLINICAL_CONTEXT = "treatment" as const;
export const TREATMENT_IMAGING_CAPTURE_SOURCE = "treatment_imaging" as const;

export const TREATMENT_IMAGING_VIEW_SLUGS = [
  "front_hairline",
  "left_side",
  "right_side",
  "top",
  "crown",
  "misc",
] as const;

export type TreatmentImagingViewSlug = (typeof TREATMENT_IMAGING_VIEW_SLUGS)[number];

export const TREATMENT_IMAGING_REQUIRED_VIEW_SLUGS = [
  "front_hairline",
  "left_side",
  "right_side",
  "top",
  "crown",
] as const satisfies readonly TreatmentImagingViewSlug[];

/** Booking types that trigger the Treatment Photos checklist. */
export const REGENERATIVE_TREATMENT_BOOKING_TYPES = [
  "prp",
  "prf",
  "mesotherapy",
  "exosomes",
] as const;

export type RegenerativeTreatmentBookingType =
  (typeof REGENERATIVE_TREATMENT_BOOKING_TYPES)[number];

const REGENERATIVE_TYPE_SET = new Set<string>(REGENERATIVE_TREATMENT_BOOKING_TYPES);

export type TreatmentImagingBookingHints = {
  title?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  serviceName?: string | null;
};

function normalizedBookingText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) =>
      String(p ?? "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .join(" ");
}

export function isDutasterideMesotherapyBooking(
  bookingType: string,
  hints: TreatmentImagingBookingHints = {}
): boolean {
  const t = bookingType.trim().toLowerCase();
  if (t !== "mesotherapy") return false;
  const blob = normalizedBookingText(
    hints.title,
    hints.description,
    hints.serviceName,
    readMetadataTreatmentLabel(hints.metadata)
  );
  return /\bdutasteride\b/.test(blob);
}

function readMetadataTreatmentLabel(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || typeof metadata !== "object") return "";
  const keys = ["service_name", "service_label", "treatment_label", "procedure_name"] as const;
  for (const key of keys) {
    const v = metadata[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export function isRegenerativeTreatmentBookingType(
  bookingType: string,
  hints: TreatmentImagingBookingHints = {}
): boolean {
  const t = bookingType.trim().toLowerCase();
  if (REGENERATIVE_TYPE_SET.has(t)) return true;
  return isDutasterideMesotherapyBooking(t, hints);
}

export function isSurgeryBookingType(bookingType: string): boolean {
  const t = bookingType.trim().toLowerCase();
  return t === "surgery" || t.includes("transplant");
}

/**
 * Whether FI OS should surface the Treatment Photos checklist for this booking.
 * Excludes consultations and transplant surgery bookings.
 */
export function requiresTreatmentPhotosChecklist(
  bookingType: string,
  hints: TreatmentImagingBookingHints = {}
): boolean {
  const t = bookingType.trim().toLowerCase();
  if (isConsultationLikeBookingType(t)) return false;
  if (isSurgeryBookingType(t)) return false;
  return isRegenerativeTreatmentBookingType(t, hints);
}

export function treatmentImagingProtocolSlots(): VieProtocolSlotDef[] {
  return getVieProtocolOrThrow(TREATMENT_IMAGING_PROTOCOL_SLUG).slots;
}

export function treatmentImagingProtocolSlotDefs(): ProtocolSlotDef[] {
  return treatmentImagingProtocolSlots().map((s) => ({
    slug: s.slug,
    label: s.label,
    required: s.required,
    suggested_region: s.suggested_region,
  }));
}

export function resolveTreatmentTypeLabel(
  bookingType: string,
  hints: TreatmentImagingBookingHints = {}
): string {
  const t = bookingType.trim().toLowerCase();
  if (isDutasterideMesotherapyBooking(t, hints)) return "dutasteride_mesotherapy";
  if (t === "prp" || t === "prf") return t;
  if (t === "exosomes") return "exosomes";
  if (t === "mesotherapy") return "mesotherapy";
  return t || "treatment";
}

export type TreatmentImagingSlotStatus = {
  slug: TreatmentImagingViewSlug;
  label: string;
  required: boolean;
  complete: boolean;
  patientImageId: string | null;
};

export type TreatmentImagingCompletionState = {
  slots: TreatmentImagingSlotStatus[];
  requiredComplete: number;
  requiredTotal: number;
  percent: number;
  complete: boolean;
  missingRequiredSlugs: string[];
};

export function buildTreatmentImagingCompletionState(
  progress: Record<string, unknown>
): TreatmentImagingCompletionState {
  const slots = treatmentImagingProtocolSlotDefs();
  const slotStatuses: TreatmentImagingSlotStatus[] = treatmentImagingProtocolSlots().map((s) => {
    const imageId = readSlotImageId(progress, s.slug);
    return {
      slug: s.slug as TreatmentImagingViewSlug,
      label: s.label,
      required: s.required !== false,
      complete: slotIsSatisfied({ slug: s.slug, label: s.label, required: s.required }, progress),
      patientImageId: imageId,
    };
  });
  const requiredTotal = slots.filter((s) => s.required !== false).length;
  const requiredComplete = requiredTotal - missingRequiredSlotSlugs(slots, progress).length;
  const percent = protocolRequiredCompletionPercent(slots, progress);
  return {
    slots: slotStatuses,
    requiredComplete,
    requiredTotal,
    percent,
    complete: missingRequiredSlotSlugs(slots, progress).length === 0,
    missingRequiredSlugs: missingRequiredSlotSlugs(slots, progress),
  };
}

function readSlotImageId(progress: Record<string, unknown>, slotSlug: string): string | null {
  const raw = progress[slotSlug];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const id = (raw as { patient_image_id?: unknown }).patient_image_id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

export const TREATMENT_PHOTOS_INCOMPLETE_WARNING =
  "Treatment photos are incomplete. Capture all five required scalp views before completing this booking.";

export const TREATMENT_PHOTOS_BLOCKED_MESSAGE =
  "This clinic requires treatment photos before booking completion. Capture all five required scalp views first.";

export function treatmentImagingTimelineSummary(image: {
  imaging_protocol_template_slug?: string | null;
  imaging_protocol_slot_slug?: string | null;
  booking_id?: string | null;
}): string | null {
  if (image.imaging_protocol_template_slug !== TREATMENT_IMAGING_PROTOCOL_SLUG) return null;
  const view = image.imaging_protocol_slot_slug?.replace(/_/g, " ") ?? "view";
  const bookingRef = image.booking_id ? ` · booking ${image.booking_id.slice(0, 8)}` : "";
  return `Treatment session photos · ${view}${bookingRef}`;
}
