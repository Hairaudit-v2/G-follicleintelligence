/**
 * Imaging Core — route patient image context to the correct ImagingOS adapter (Phase 1).
 */

import { buildConsultationOsImageIngestionRequest } from "@/src/lib/imaging-os/adapters/consultationOsImageAdapter";
import { buildFiOsPatientImageIngestionRequest } from "@/src/lib/imaging-os/adapters/fiOsPatientImageAdapter";
import { buildFollowUpOutcomeImageIngestionRequest } from "@/src/lib/imaging-os/adapters/followUpOutcomeImageAdapter";
import { buildHairauditImageIngestionRequest } from "@/src/lib/imaging-os/adapters/hairauditImageAdapter";
import { buildHliImageIngestionRequest } from "@/src/lib/imaging-os/adapters/hliImageAdapter";
import { buildIiohrImageIngestionRequest } from "@/src/lib/imaging-os/adapters/iiohrImageAdapter";
import { buildPatientPortalImageIngestionRequest } from "@/src/lib/imaging-os/adapters/patientPortalImageAdapter";
import { buildSurgeryOsImageIngestionRequest } from "@/src/lib/imaging-os/adapters/surgeryOsImageAdapter";
import type { ImagingOsImageIngestionRequest } from "@/src/lib/imaging-os/intake";
import { parsePatientImageIngestionContext } from "./parsePatientImageIngestionContext";
import type {
  FlatPatientImageIngestionContext,
  ParsedPatientImageIngestContext,
} from "./patientImageIngestContextTypes";

export type { PatientImageIngestionContext } from "./patientImageIngestContextTypes";

function buildSharedMetadata(ctx: ParsedPatientImageIngestContext): Record<string, unknown> {
  return {
    ...(ctx.fi_event_id ? { fi_event_id: ctx.fi_event_id } : {}),
    ...(ctx.fi_upload_id ? { fi_upload_id: ctx.fi_upload_id } : {}),
    ...(ctx.metadata ?? {}),
  };
}

function buildFromParsedContext(
  ctx: ParsedPatientImageIngestContext
): ImagingOsImageIngestionRequest {
  const sharedMetadata = buildSharedMetadata(ctx);

  switch (ctx.kind) {
    case "hairaudit":
      return buildHairauditImageIngestionRequest({
        tenant_id: ctx.tenant_id,
        case_id: ctx.case_id?.trim() || ctx.patient_id,
        external_image_id: ctx.fi_upload_id?.trim() || ctx.image_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        external_category:
          ctx.hairaudit_image_type?.trim() || ctx.external_category?.trim() || "other",
        legacy_upload_type: ctx.legacy_upload_type,
        patient_id: ctx.patient_id,
        metadata: sharedMetadata,
      });

    case "hli":
      return buildHliImageIngestionRequest({
        patient_id: ctx.patient_id,
        external_image_id: ctx.fi_upload_id?.trim() || ctx.image_id,
        external_category:
          ctx.hli_document_kind?.trim() || ctx.external_category?.trim() || "supporting_docs",
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        upload_surface: "internal_api",
        metadata: {
          legacy_upload_type: ctx.legacy_upload_type,
          ...sharedMetadata,
        },
      });

    case "iiohr":
      return buildIiohrImageIngestionRequest({
        tenant_id: ctx.tenant_id,
        case_id: ctx.case_id?.trim() || ctx.patient_id,
        external_image_id: ctx.image_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        external_category:
          ctx.external_category?.trim() || ctx.hairaudit_image_type?.trim() || "other",
        legacy_upload_type: ctx.legacy_upload_type,
        patient_id: ctx.patient_id,
        metadata: sharedMetadata,
      });

    case "consultation_os":
      return buildConsultationOsImageIngestionRequest({
        tenant_id: ctx.tenant_id ?? "",
        patient_id: ctx.patient_id,
        image_id: ctx.image_id,
        case_id: ctx.case_id,
        consultation_id: ctx.consultation_id,
        form_instance_id: ctx.form_instance_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        external_category: ctx.external_category ?? ctx.image_category,
        anatomical_region: ctx.anatomical_region,
        captured_by_staff_id: ctx.captured_by_staff_id,
        metadata: sharedMetadata,
      });

    case "surgery_os":
      return buildSurgeryOsImageIngestionRequest({
        tenant_id: ctx.tenant_id ?? "",
        patient_id: ctx.patient_id,
        image_id: ctx.image_id,
        case_id: ctx.case_id,
        booking_id: ctx.booking_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        protocol_template_slug: ctx.protocol_template_slug,
        protocol_slot_slug: ctx.protocol_slot_slug,
        procedure_day_id: ctx.procedure_day_id,
        captured_by_staff_id: ctx.captured_by_staff_id,
        metadata: sharedMetadata,
      });

    case "legacy_follow_up":
      return buildFollowUpOutcomeImageIngestionRequest({
        tenant_id: ctx.tenant_id ?? "",
        patient_id: ctx.patient_id,
        image_id: ctx.image_id,
        case_id: ctx.case_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        protocol_template_slug: ctx.protocol_template_slug,
        protocol_slot_slug: ctx.protocol_slot_slug,
        follow_up_interval: ctx.follow_up_interval,
        visit_type: ctx.visit_type,
        captured_by_staff_id: ctx.captured_by_staff_id,
        metadata: sharedMetadata,
      });

    case "patient_portal":
      return buildPatientPortalImageIngestionRequest({
        tenant_id: ctx.tenant_id ?? "",
        patient_id: ctx.patient_id,
        image_id: ctx.image_id,
        case_id: ctx.case_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        external_category: ctx.external_category ?? ctx.image_category,
        protocol_template_slug: ctx.protocol_template_slug,
        protocol_slot_slug: ctx.protocol_slot_slug,
        follow_up_interval: ctx.follow_up_interval,
        metadata: sharedMetadata,
      });

    case "imaging_os_wizard":
    case "vie_capture_wizard":
    case "generic_fi_os":
    case "unknown":
      return buildFiOsPatientImageIngestionRequest({
        tenant_id: ctx.tenant_id,
        patient_id: ctx.patient_id,
        image_id: ctx.image_id,
        case_id: ctx.case_id,
        consultation_id: ctx.consultation_id,
        storage_bucket: ctx.storage_bucket,
        storage_path: ctx.storage_path,
        content_type: ctx.content_type,
        size_bytes: ctx.size_bytes,
        external_category: ctx.external_category ?? ctx.image_category,
        capture_source: ctx.capture_source || "unknown",
        protocol_template_slug: ctx.protocol_template_slug,
        protocol_slot_slug: ctx.protocol_slot_slug,
        follow_up_interval: ctx.follow_up_interval,
        visit_type: ctx.visit_type,
        anatomical_region: ctx.anatomical_region,
        captured_by_staff_id: ctx.captured_by_staff_id,
        metadata: sharedMetadata,
      });
  }
}

/**
 * Select adapter and build universal ingestion request from patient image context.
 * Accepts legacy flat input or a pre-parsed discriminated context.
 */
export function buildPatientImageIngestionRequest(
  input: FlatPatientImageIngestionContext | ParsedPatientImageIngestContext
): ImagingOsImageIngestionRequest {
  const ctx = "kind" in input ? input : parsePatientImageIngestionContext(input);
  return buildFromParsedContext(ctx);
}