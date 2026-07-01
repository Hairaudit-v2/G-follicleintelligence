/**
 * Patient portal follow-up image upload defaults (Phase 1 imaging consolidation).
 */

import {
  buildGuidedVisitType,
  mapTemplateSlugToImagingLibraryAxis,
} from "@/src/lib/imagingOs/imagingOsConstants";
import { getVieProtocol } from "@/src/lib/vie/vieProtocolCatalog";

export const PATIENT_PORTAL_IMAGE_PROTOCOL_TEMPLATE = "follow_up_review" as const;

export const PATIENT_PORTAL_IMAGE_SLOT_OPTIONS = [
  { slug: "fu_front", label: "Front / hairline" },
  { slug: "fu_top", label: "Top / crown" },
  { slug: "fu_donor", label: "Donor area" },
] as const;

export type PatientPortalImageSlotSlug =
  (typeof PATIENT_PORTAL_IMAGE_SLOT_OPTIONS)[number]["slug"];

export function normalizePatientPortalImageSlotSlug(
  raw: string | null | undefined
): PatientPortalImageSlotSlug {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase();
  const allowed = PATIENT_PORTAL_IMAGE_SLOT_OPTIONS.map((o) => o.slug);
  if ((allowed as readonly string[]).includes(slug)) {
    return slug as PatientPortalImageSlotSlug;
  }
  return "fu_front";
}

export function buildPatientPortalImageUploadFields(input?: {
  protocolSlotSlug?: string | null;
  followUpInterval?: string | null;
}) {
  const templateSlug = PATIENT_PORTAL_IMAGE_PROTOCOL_TEMPLATE;
  const slotSlug = normalizePatientPortalImageSlotSlug(input?.protocolSlotSlug);
  const protocol = getVieProtocol(templateSlug);
  const slot = protocol?.slots.find((s) => s.slug === slotSlug);
  return {
    capture_source: "patient_portal" as const,
    imaging_protocol_template_slug: templateSlug,
    imaging_protocol_slot_slug: slotSlug,
    imaging_library_axis: mapTemplateSlugToImagingLibraryAxis(templateSlug),
    visit_type: buildGuidedVisitType(templateSlug),
    image_category: "progress" as const,
    anatomical_region: slot?.suggested_region ?? null,
    follow_up_interval: input?.followUpInterval?.trim() || null,
  };
}