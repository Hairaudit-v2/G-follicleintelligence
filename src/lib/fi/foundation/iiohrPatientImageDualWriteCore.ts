/**
 * IIOHR academy → fi_patient_images dual-write (pure helpers).
 *
 * Until the IIOHR academy producer emits `iiohr.images.uploaded`, academy images may
 * still arrive via `hairaudit.images.uploaded` (see hairauditPatientImageDualWrite).
 */

import { normalizeFiUploadType } from "@/lib/fi/uploadTypes";
import {
  mapCanonicalToPatientImageCategory,
  mapExternalCategoryToCanonical,
} from "@/src/lib/imaging-core/vocabulary";
import { mapTemplateSlugToImagingLibraryAxis } from "@/src/lib/imagingOs/imagingOsConstants";
import type { PatientImageCategory } from "@/src/lib/patientImages/patientImageTypes";
import type { IiohrImagesUploadedPayload } from "@/src/types/fi-events";

export const IIOHR_PATIENT_IMAGE_UPLOAD_SOURCE = "iiohr" as const;
export const IIOHR_PATIENT_IMAGE_CAPTURE_SOURCE = "iiohr_academy" as const;
export const IIOHR_DEFAULT_STORAGE_BUCKET = "case-files" as const;

export type IiohrPatientImageInsertPlan = {
  storage_path: string;
  storage_bucket: string;
  image_category: PatientImageCategory;
  imaging_library_axis: ReturnType<typeof mapTemplateSlugToImagingLibraryAxis>;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
};

export function resolveIiohrImageStoragePath(
  payload: Pick<IiohrImagesUploadedPayload, "storage_path" | "image_url">
): string | null {
  const storagePath = payload.storage_path?.trim();
  if (storagePath) return storagePath;
  const imageUrl = payload.image_url?.trim();
  if (imageUrl) return imageUrl;
  return null;
}

export function resolveIiohrExternalView(payload: IiohrImagesUploadedPayload): string {
  return (
    payload.external_view?.trim() ||
    payload.canonical_view?.trim() ||
    "other"
  );
}

export function buildIiohrPatientImageMetadata(input: {
  fiEventId: string;
  sourceSystem: string;
  academyCaseId: string;
  sourcePatientId: string | null;
  foundationPatientId?: string | null;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  externalView: string;
  canonicalView: string;
  professionalId?: string | null;
  globalProfessionalId?: string | null;
  imageUrl?: string | null;
  occurredAt?: string | null;
  payloadMetadata?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    upload_source: IIOHR_PATIENT_IMAGE_UPLOAD_SOURCE,
    capture_source: IIOHR_PATIENT_IMAGE_CAPTURE_SOURCE,
    academy_case_id: input.academyCaseId,
    external_view: input.externalView,
    canonical_view: input.canonicalView,
    fi_event_id: input.fiEventId,
    source_system: input.sourceSystem,
    ...(input.sourcePatientId ? { source_patient_id: input.sourcePatientId } : {}),
    ...(input.foundationPatientId ? { foundation_patient_id: input.foundationPatientId } : {}),
    ...(input.globalCaseId ? { global_case_id: input.globalCaseId } : {}),
    ...(input.fiUploadId ? { fi_upload_id: input.fiUploadId } : {}),
    ...(input.professionalId ? { professional_id: input.professionalId } : {}),
    ...(input.globalProfessionalId ? { global_professional_id: input.globalProfessionalId } : {}),
    ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    ...(input.occurredAt ? { iiohr_uploaded_at: input.occurredAt } : {}),
    ...(input.payloadMetadata ?? {}),
    dual_write: "imagingos_phase1_foundation",
  };
}

export function planIiohrPatientImageInsert(input: {
  payload: IiohrImagesUploadedPayload;
  fiEventId: string;
  sourceSystem: string;
  academyCaseId: string;
  sourcePatientId: string | null;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  occurredAt?: string | null;
  storageBucket?: string | null;
}): IiohrPatientImageInsertPlan | null {
  const storagePath = resolveIiohrImageStoragePath(input.payload);
  if (!storagePath) return null;

  const externalView = resolveIiohrExternalView(input.payload);
  const legacyUploadType = normalizeFiUploadType(externalView);
  const mapping = mapExternalCategoryToCanonical(externalView, legacyUploadType);
  const metadata = buildIiohrPatientImageMetadata({
    fiEventId: input.fiEventId,
    sourceSystem: input.sourceSystem,
    academyCaseId: input.academyCaseId,
    sourcePatientId: input.sourcePatientId,
    foundationPatientId: input.payload.patient_id?.trim() || null,
    globalCaseId: input.globalCaseId,
    fiUploadId: input.fiUploadId,
    externalView,
    canonicalView: mapping.canonical,
    professionalId: input.payload.professional_id?.trim() || null,
    globalProfessionalId: input.payload.global_professional_id?.trim() || null,
    imageUrl: input.payload.image_url?.trim() || null,
    occurredAt: input.payload.uploaded_at?.trim() || input.occurredAt,
    payloadMetadata:
      input.payload.metadata && typeof input.payload.metadata === "object"
        ? input.payload.metadata
        : undefined,
  });

  return {
    storage_path: storagePath,
    storage_bucket: input.storageBucket?.trim() || IIOHR_DEFAULT_STORAGE_BUCKET,
    image_category: mapCanonicalToPatientImageCategory(mapping.canonical),
    imaging_library_axis: mapTemplateSlugToImagingLibraryAxis("hair_transplant_planning"),
    original_filename: input.payload.original_filename?.trim() || null,
    content_type: input.payload.mime_type?.trim() || null,
    file_size_bytes:
      input.payload.size_bytes != null && Number.isFinite(input.payload.size_bytes)
        ? Math.max(0, Math.round(input.payload.size_bytes))
        : null,
    metadata,
  };
}