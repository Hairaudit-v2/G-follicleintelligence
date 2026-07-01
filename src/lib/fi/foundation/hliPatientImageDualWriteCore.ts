/**
 * HLI → fi_patient_images dual-write (pure helpers).
 */

import { normalizeFiUploadType } from "@/lib/fi/uploadTypes";
import {
  mapCanonicalToPatientImageCategory,
  mapExternalCategoryToCanonical,
} from "@/src/lib/imaging-core/vocabulary";
import { mapTemplateSlugToImagingLibraryAxis } from "@/src/lib/imagingOs/imagingOsConstants";
import type { PatientImageCategory } from "@/src/lib/patientImages/patientImageTypes";
import type { HliDocumentUploadedPayload } from "@/src/types/fi-events";

export const HLI_PATIENT_IMAGE_UPLOAD_SOURCE = "hair_longevity" as const;
export const HLI_DEFAULT_STORAGE_BUCKET = "case-files" as const;

const IMAGE_MIME_PREFIX = "image/";
const IMAGE_FILENAME_RE = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

export type HliPatientImageDualWriteDocument = HliDocumentUploadedPayload["document"];

export type HliPatientImageInsertPlan = {
  storage_path: string;
  storage_bucket: string;
  image_category: PatientImageCategory;
  imaging_library_axis: ReturnType<typeof mapTemplateSlugToImagingLibraryAxis>;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
};

export function isHliDocumentEligibleForPatientImageDualWrite(
  document: HliPatientImageDualWriteDocument
): boolean {
  const kind = document.kind?.trim().toLowerCase() ?? "";
  if (kind === "blood_pdf" || kind === "blood_csv") return false;

  const mime = document.mime_type?.trim().toLowerCase() ?? "";
  if (mime.startsWith(IMAGE_MIME_PREFIX)) return true;

  const filename = document.filename?.trim() ?? "";
  return IMAGE_FILENAME_RE.test(filename);
}

export function buildHliPatientImageMetadata(input: {
  fiEventId: string;
  sourceSystem: string;
  sourceCaseId: string | null;
  sourcePatientId: string | null;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  documentKind: string;
  canonicalView: string;
  classifierStatus?: string | null;
  occurredAt?: string | null;
}): Record<string, unknown> {
  return {
    upload_source: HLI_PATIENT_IMAGE_UPLOAD_SOURCE,
    hli_document_kind: input.documentKind,
    canonical_view: input.canonicalView,
    fi_event_id: input.fiEventId,
    source_system: input.sourceSystem,
    ...(input.sourceCaseId ? { source_case_id: input.sourceCaseId } : {}),
    ...(input.sourcePatientId ? { source_patient_id: input.sourcePatientId } : {}),
    ...(input.globalCaseId ? { global_case_id: input.globalCaseId } : {}),
    ...(input.fiUploadId ? { fi_upload_id: input.fiUploadId } : {}),
    ...(input.classifierStatus ? { classifier_status: input.classifierStatus } : {}),
    ...(input.occurredAt ? { hli_uploaded_at: input.occurredAt } : {}),
    dual_write: "imagingos_phase0_foundation",
  };
}

export function planHliPatientImageInsert(input: {
  document: HliPatientImageDualWriteDocument;
  fiEventId: string;
  sourceSystem: string;
  sourceCaseId: string | null;
  sourcePatientId: string | null;
  globalCaseId?: string | null;
  fiUploadId?: string | null;
  occurredAt?: string | null;
  storageBucket?: string | null;
}): HliPatientImageInsertPlan | null {
  if (!isHliDocumentEligibleForPatientImageDualWrite(input.document)) return null;

  const storagePath = input.document.storage_path?.trim();
  if (!storagePath) return null;

  const legacyUploadType = normalizeFiUploadType(input.document.kind);
  const mapping = mapExternalCategoryToCanonical(input.document.kind, legacyUploadType);
  const metadata = buildHliPatientImageMetadata({
    fiEventId: input.fiEventId,
    sourceSystem: input.sourceSystem,
    sourceCaseId: input.sourceCaseId,
    sourcePatientId: input.sourcePatientId,
    globalCaseId: input.globalCaseId,
    fiUploadId: input.fiUploadId,
    documentKind: input.document.kind,
    canonicalView: mapping.canonical,
    occurredAt: input.occurredAt,
  });

  return {
    storage_path: storagePath,
    storage_bucket: input.storageBucket?.trim() || HLI_DEFAULT_STORAGE_BUCKET,
    image_category: mapCanonicalToPatientImageCategory(mapping.canonical),
    imaging_library_axis: mapTemplateSlugToImagingLibraryAxis("hair_loss_consultation"),
    original_filename: input.document.filename?.trim() || null,
    content_type: input.document.mime_type?.trim() || null,
    file_size_bytes:
      input.document.size_bytes != null && Number.isFinite(input.document.size_bytes)
        ? Math.max(0, Math.round(input.document.size_bytes))
        : null,
    metadata,
  };
}