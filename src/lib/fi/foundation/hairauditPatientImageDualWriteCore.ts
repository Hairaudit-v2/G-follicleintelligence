/**
 * HairAudit → fi_patient_images dual-write (pure helpers).
 * Server ingest calls these; tests import without server-only constraints.
 */

import {
  mapCanonicalToPatientImageCategory,
  mapExternalCategoryToCanonical,
} from "@/src/lib/imaging-core/vocabulary";
import { mapTemplateSlugToImagingLibraryAxis } from "@/src/lib/imagingOs/imagingOsConstants";
import type { PatientImageCategory } from "@/src/lib/patientImages/patientImageTypes";
import type { HairAuditImagesUploadedPayload } from "@/src/types/fi-events";

export const HAIRAUDIT_PATIENT_IMAGE_UPLOAD_SOURCE = "hairaudit" as const;
export const HAIRAUDIT_DEFAULT_STORAGE_BUCKET = "case-files" as const;

export type HairAuditPatientImageDualWriteImage = HairAuditImagesUploadedPayload["images"][number];

export type HairAuditPatientImageInsertPlan = {
  storage_path: string;
  storage_bucket: string;
  image_category: PatientImageCategory;
  imaging_library_axis: ReturnType<typeof mapTemplateSlugToImagingLibraryAxis>;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
};

export function buildHairAuditPatientImageMetadata(input: {
  fiEventId: string;
  sourceSystem: string;
  sourceCaseId: string | null;
  sourcePatientId: string | null;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  hairauditImageType: string;
  canonicalView: string;
  classifierStatus?: string | null;
  occurredAt?: string | null;
}): Record<string, unknown> {
  return {
    upload_source: HAIRAUDIT_PATIENT_IMAGE_UPLOAD_SOURCE,
    hairaudit_image_type: input.hairauditImageType,
    canonical_view: input.canonicalView,
    fi_event_id: input.fiEventId,
    source_system: input.sourceSystem,
    ...(input.sourceCaseId ? { source_case_id: input.sourceCaseId } : {}),
    ...(input.sourcePatientId ? { source_patient_id: input.sourcePatientId } : {}),
    ...(input.globalCaseId ? { global_case_id: input.globalCaseId } : {}),
    ...(input.fiUploadId ? { fi_upload_id: input.fiUploadId } : {}),
    ...(input.classifierStatus ? { classifier_status: input.classifierStatus } : {}),
    ...(input.occurredAt ? { hairaudit_uploaded_at: input.occurredAt } : {}),
    dual_write: "imagingos_phase1_foundation",
  };
}

export function planHairAuditPatientImageInsert(input: {
  image: HairAuditPatientImageDualWriteImage;
  fiEventId: string;
  sourceSystem: string;
  sourceCaseId: string | null;
  sourcePatientId: string | null;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  occurredAt?: string | null;
  storageBucket?: string | null;
}): HairAuditPatientImageInsertPlan | null {
  const storagePath = input.image.storage_path?.trim();
  if (!storagePath) return null;

  const mapping = mapExternalCategoryToCanonical(input.image.type);
  const metadata = buildHairAuditPatientImageMetadata({
    fiEventId: input.fiEventId,
    sourceSystem: input.sourceSystem,
    sourceCaseId: input.sourceCaseId,
    sourcePatientId: input.sourcePatientId,
    globalCaseId: input.globalCaseId,
    fiUploadId: input.fiUploadId,
    hairauditImageType: input.image.type,
    canonicalView: mapping.canonical,
    occurredAt: input.occurredAt,
  });

  return {
    storage_path: storagePath,
    storage_bucket: input.storageBucket?.trim() || HAIRAUDIT_DEFAULT_STORAGE_BUCKET,
    image_category: mapCanonicalToPatientImageCategory(mapping.canonical),
    imaging_library_axis: mapTemplateSlugToImagingLibraryAxis("hair_transplant_planning"),
    original_filename: input.image.filename?.trim() || null,
    content_type: input.image.mime_type?.trim() || null,
    file_size_bytes:
      input.image.size_bytes != null && Number.isFinite(input.image.size_bytes)
        ? Math.max(0, Math.round(input.image.size_bytes))
        : null,
    metadata,
  };
}