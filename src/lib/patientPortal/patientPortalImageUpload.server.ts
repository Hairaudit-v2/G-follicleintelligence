import "server-only";

import { revalidatePath } from "next/cache";

import { assertPatientTrialConsentRecorded } from "@/src/lib/patients/patientConsentGate.server";
import { createPatientImageRecord } from "@/src/lib/patientImages/patientImagesServer";
import { loadPatientPortalPatientRow } from "./patientPortalAccess.server";
import { buildPatientPortalImageUploadFields } from "./patientPortalImageUploadCore";

export type PatientPortalImageUploadInput = {
  tenantId: string;
  file: File;
  protocolSlotSlug?: string | null;
  followUpInterval?: string | null;
  caption?: string | null;
};

export async function uploadPatientPortalImage(input: PatientPortalImageUploadInput) {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");

  const portal = await loadPatientPortalPatientRow(tid);
  if (!portal) {
    throw new Error("Sign in with a patient-linked portal account to upload images.");
  }

  await assertPatientTrialConsentRecorded(tid, portal.patientId);

  const fields = buildPatientPortalImageUploadFields({
    protocolSlotSlug: input.protocolSlotSlug,
    followUpInterval: input.followUpInterval,
  });

  const result = await createPatientImageRecord({
    tenantId: tid,
    patientId: portal.patientId,
    file: input.file,
    imageCategory: fields.image_category,
    caption: input.caption ?? null,
    imagingLibraryAxis: fields.imaging_library_axis,
    visitType: fields.visit_type,
    followUpInterval: fields.follow_up_interval,
    imagingProtocolTemplateSlug: fields.imaging_protocol_template_slug,
    imagingProtocolSlotSlug: fields.imaging_protocol_slot_slug,
    anatomicalRegion: fields.anatomical_region,
    captureSource: fields.capture_source,
    captureType: "upload",
    metadata: {
      patient_portal: true,
      capture_source: fields.capture_source,
      protocol_template_slug: fields.imaging_protocol_template_slug,
      protocol_slot_slug: fields.imaging_protocol_slot_slug,
    },
  });

  const qualityAlert = result.attribution?.quality?.alert_message;
  if (qualityAlert) {
    throw new Error(qualityAlert);
  }

  revalidatePath(`/patient/${tid}/imaging`);

  return {
    image: result.row,
    changed_keys: result.changed_keys,
  };
}