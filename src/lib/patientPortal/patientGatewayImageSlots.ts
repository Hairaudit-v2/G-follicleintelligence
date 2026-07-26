/**
 * FI-PATIENT-APP-1C — patient-facing image slot vocabulary + FiOS pathway mapping.
 * Mobile clients depend only on these slots — never legacy internal category names.
 */

import {
  buildPatientPortalImageUploadFields,
  PATIENT_PORTAL_IMAGE_SLOT_OPTIONS,
  type PatientPortalImageSlotSlug,
} from "@/src/lib/patientPortal/patientPortalImageUploadCore";
import type { PatientImageCategory } from "@/src/lib/patientImages/patientImageTypes";

export const PATIENT_GATEWAY_IMAGE_SLOTS = [
  {
    slot: "front_hairline",
    label: "Front / hairline",
    protocolSlotSlug: "fu_front",
  },
  {
    slot: "top_crown",
    label: "Top / crown",
    protocolSlotSlug: "fu_top",
  },
  {
    slot: "donor_area",
    label: "Donor area",
    protocolSlotSlug: "fu_donor",
  },
] as const;

export type PatientGatewayImageSlot = (typeof PATIENT_GATEWAY_IMAGE_SLOTS)[number]["slot"];

const SLOT_SET = new Set<string>(PATIENT_GATEWAY_IMAGE_SLOTS.map((s) => s.slot));

export type PatientGatewayImageSlotMapping = {
  slot: PatientGatewayImageSlot;
  protocolSlotSlug: PatientPortalImageSlotSlug;
  protocolTemplateSlug: string;
  imageCategory: PatientImageCategory;
  imagingLibraryAxis: string;
  visitType: string;
  anatomicalRegion: string | null;
  captureSource: "patient_portal";
};

export function isPatientGatewayImageSlot(value: unknown): value is PatientGatewayImageSlot {
  return typeof value === "string" && SLOT_SET.has(value.trim());
}

export function parsePatientGatewayImageSlot(
  value: unknown
): PatientGatewayImageSlot | null {
  if (!isPatientGatewayImageSlot(value)) return null;
  return value.trim() as PatientGatewayImageSlot;
}

/**
 * Deterministic mapping: patient-facing slot → FiOS/pathway upload fields.
 */
export function mapPatientGatewayImageSlot(
  slot: PatientGatewayImageSlot
): PatientGatewayImageSlotMapping {
  const def = PATIENT_GATEWAY_IMAGE_SLOTS.find((s) => s.slot === slot);
  if (!def) {
    throw new Error(`Unknown patient gateway image slot: ${slot}`);
  }
  // Ensure protocol slug remains one of the portal-supported slots.
  const allowed = PATIENT_PORTAL_IMAGE_SLOT_OPTIONS.map((o) => o.slug);
  if (!(allowed as readonly string[]).includes(def.protocolSlotSlug)) {
    throw new Error(`Slot ${slot} maps to unsupported protocol slug.`);
  }

  const fields = buildPatientPortalImageUploadFields({
    protocolSlotSlug: def.protocolSlotSlug,
  });

  return {
    slot,
    protocolSlotSlug: def.protocolSlotSlug,
    protocolTemplateSlug: fields.imaging_protocol_template_slug,
    imageCategory: fields.image_category,
    imagingLibraryAxis: fields.imaging_library_axis,
    visitType: fields.visit_type,
    anatomicalRegion: fields.anatomical_region,
    captureSource: fields.capture_source,
  };
}
