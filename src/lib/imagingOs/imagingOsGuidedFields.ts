import { buildGuidedVisitType, mapTemplateSlugToImagingLibraryAxis, type ImagingAnatomicalRegion } from "./imagingOsConstants";
import { normalizeImagingAnatomicalRegion } from "@/src/lib/patientImages/patientImagePolicy";

export type GuidedImageUploadFieldSnapshot = {
  imaging_library_axis: string;
  visit_type: string;
  imaging_protocol_template_slug: string;
  imaging_protocol_slot_slug: string;
  anatomical_region: ImagingAnatomicalRegion | null;
  device_type: string;
  clinic_id: string | null;
  captured_by_staff_id: string | null;
};

/**
 * Canonical field snapshot for guided capture (used by UI FormData and unit tests).
 */
export function buildGuidedImageUploadFields(args: {
  templateSlug: string;
  slotSlug: string;
  deviceType: string;
  clinicId?: string | null;
  capturedByStaffId?: string | null;
  suggestedRegion?: string | null;
}): GuidedImageUploadFieldSnapshot {
  const anatomical_region = normalizeImagingAnatomicalRegion(args.suggestedRegion ?? null);
  return {
    imaging_library_axis: mapTemplateSlugToImagingLibraryAxis(args.templateSlug),
    visit_type: buildGuidedVisitType(args.templateSlug),
    imaging_protocol_template_slug: args.templateSlug.trim(),
    imaging_protocol_slot_slug: args.slotSlug.trim(),
    anatomical_region,
    device_type: args.deviceType.trim().slice(0, 160),
    clinic_id: args.clinicId?.trim() || null,
    captured_by_staff_id: args.capturedByStaffId?.trim() || null,
  };
}

export function assertGuidedSessionUploadPreconditions(args: {
  tenantId: string;
  patientId: string;
  protocolSessionId: string;
  slotSlug: string;
}): void {
  if (!args.tenantId.trim()) throw new Error("tenant_id is required.");
  if (!args.patientId.trim()) throw new Error("patient_id is required.");
  if (!args.protocolSessionId.trim()) throw new Error("protocol_session_id is required for guided capture.");
  const sid = args.protocolSessionId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)) {
    throw new Error("protocol_session_id must be a valid UUID.");
  }
  if (!args.slotSlug.trim()) throw new Error("protocol slot slug is required for guided capture.");
}
