import { isPatientImageMetadataObject } from "./patientImagePolicy";
import type { ImagingAnatomicalRegion, ImagingLibraryAxis } from "@/src/lib/imagingOs/imagingOsConstants";
import type { PatientImageCategory } from "./patientImageTypes";

export type PatientImageEditableSnapshot = {
  image_category: PatientImageCategory;
  caption: string | null;
  taken_at: string | null;
  metadata: Record<string, unknown>;
  imaging_library_axis: ImagingLibraryAxis;
  clinic_id: string | null;
  captured_by_staff_id: string | null;
  device_type: string | null;
  anatomical_region: ImagingAnatomicalRegion | null;
  visit_type: string | null;
  follow_up_interval: string | null;
  imaging_protocol_template_slug: string | null;
  imaging_protocol_slot_slug: string | null;
  consultation_id: string | null;
};

function stableStringifyMeta(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function patientImageDetailChangedKeys(before: PatientImageEditableSnapshot, after: PatientImageEditableSnapshot): string[] {
  const keys: string[] = [];
  if (before.image_category !== after.image_category) keys.push("image_category");
  const bc = before.caption ?? null;
  const ac = after.caption ?? null;
  if (bc !== ac) keys.push("caption");
  const bt = before.taken_at ?? null;
  const at = after.taken_at ?? null;
  if (bt !== at) keys.push("taken_at");
  const bm = isPatientImageMetadataObject(before.metadata) ? before.metadata : {};
  const am = isPatientImageMetadataObject(after.metadata) ? after.metadata : {};
  if (stableStringifyMeta(bm) !== stableStringifyMeta(am)) keys.push("metadata");
  if (before.imaging_library_axis !== after.imaging_library_axis) keys.push("imaging_library_axis");
  if ((before.clinic_id ?? null) !== (after.clinic_id ?? null)) keys.push("clinic_id");
  if ((before.captured_by_staff_id ?? null) !== (after.captured_by_staff_id ?? null)) keys.push("captured_by_staff_id");
  if ((before.device_type ?? null) !== (after.device_type ?? null)) keys.push("device_type");
  if ((before.anatomical_region ?? null) !== (after.anatomical_region ?? null)) keys.push("anatomical_region");
  if ((before.visit_type ?? null) !== (after.visit_type ?? null)) keys.push("visit_type");
  if ((before.follow_up_interval ?? null) !== (after.follow_up_interval ?? null)) keys.push("follow_up_interval");
  if ((before.imaging_protocol_template_slug ?? null) !== (after.imaging_protocol_template_slug ?? null)) {
    keys.push("imaging_protocol_template_slug");
  }
  if ((before.imaging_protocol_slot_slug ?? null) !== (after.imaging_protocol_slot_slug ?? null)) {
    keys.push("imaging_protocol_slot_slug");
  }
  if ((before.consultation_id ?? null) !== (after.consultation_id ?? null)) keys.push("consultation_id");
  return keys;
}

export function patientImageArchiveChangedKeys(): string[] {
  return ["image_status", "archived_at", "archived_by_user_id", "archive_reason"];
}
