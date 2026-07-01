/**
 * ImagingOS Phase 6 — patient-safe redacted imaging export cards.
 * No diagnosis, prediction, or staff-only clinical intelligence.
 */

import { readImagingStaffReviewRecord } from "./imagingStaffReviewCore";

export const PATIENT_SAFE_IMAGING_EXPORT_VERSION = "patient_safe_imaging_export_v1" as const;

export type PatientSafeImagingExportStatus =
  | "image_received"
  | "quality_suitable"
  | "clinical_review_recommended"
  | "retake_requested";

export type PatientSafeImagingExportCard = {
  image_id: string;
  photo_date: string | null;
  view_label: string | null;
  session_type: string | null;
  progress_label: string | null;
  status: PatientSafeImagingExportStatus;
  status_message: string;
  export_version: typeof PATIENT_SAFE_IMAGING_EXPORT_VERSION;
};

const FORBIDDEN_EXPORT_PATTERNS = [
  /\bnorwood\b/i,
  /\bludwig\b/i,
  /\bdiagnosis\b/i,
  /\bdensity\b/i,
  /\bgraft\b/i,
  /\bpredict/i,
  /\boutcome.?score\b/i,
  /\bconfidence\b/i,
  /\bclinical.?finding/i,
  /\bstaff.?note/i,
  /\breview.?note/i,
] as const;

export function patientSafeStatusMessage(status: PatientSafeImagingExportStatus): string {
  switch (status) {
    case "image_received":
      return "Image received";
    case "quality_suitable":
      return "Image quality suitable for review";
    case "clinical_review_recommended":
      return "Clinical team review recommended";
    case "retake_requested":
      return "Retake requested";
    default:
      return "Image received";
  }
}

export function derivePatientSafeExportStatus(input: {
  metadata: Record<string, unknown>;
  aiImageReviewStatus?: string | null;
}): PatientSafeImagingExportStatus {
  const staffReview = readImagingStaffReviewRecord(input.metadata);
  if (staffReview?.status === "retake_required") return "retake_requested";

  const quality = input.metadata.imaging_quality;
  if (quality && typeof quality === "object" && !Array.isArray(quality)) {
    const qs = (quality as { quality_status?: string }).quality_status;
    if (qs === "pass") return "quality_suitable";
    if (qs === "review" || qs === "fail") return "clinical_review_recommended";
  }

  if (input.aiImageReviewStatus === "pending") return "clinical_review_recommended";
  return "image_received";
}

export function buildPatientSafeImagingExportCard(input: {
  imageId: string;
  takenAt?: string | null;
  createdAt?: string | null;
  viewLabel?: string | null;
  sessionType?: string | null;
  progressLabel?: string | null;
  metadata: Record<string, unknown>;
  aiImageReviewStatus?: string | null;
}): PatientSafeImagingExportCard {
  const status = derivePatientSafeExportStatus({
    metadata: input.metadata,
    aiImageReviewStatus: input.aiImageReviewStatus,
  });
  return {
    image_id: input.imageId,
    photo_date: input.takenAt ?? input.createdAt ?? null,
    view_label: input.viewLabel ?? null,
    session_type: input.sessionType ?? null,
    progress_label: input.progressLabel ?? null,
    status,
    status_message: patientSafeStatusMessage(status),
    export_version: PATIENT_SAFE_IMAGING_EXPORT_VERSION,
  };
}

/** Ensures export card contains no restricted clinical fields. */
export function patientSafeExportCardIsRedacted(card: PatientSafeImagingExportCard): boolean {
  const text = [
    card.view_label,
    card.session_type,
    card.progress_label,
    card.status_message,
  ]
    .filter(Boolean)
    .join(" ");
  return !FORBIDDEN_EXPORT_PATTERNS.some((re) => re.test(text));
}

/** Strip any restricted keys from a metadata object before patient export. */
export function redactMetadataForPatientExport(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const forbiddenKeys = new Set([
    "imaging_clinical_ai",
    "imaging_job_summaries",
    "imaging_staff_review",
    "imaging_review_assignment",
    "ai_image_category_confidence",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (forbiddenKeys.has(key)) continue;
    if (key.startsWith("ai_")) continue;
    out[key] = value;
  }
  return out;
}