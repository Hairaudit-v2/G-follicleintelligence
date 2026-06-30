/**
 * ImagingOS — shared type vocabulary (Phase IM-1 foundation).
 * Pure contracts; no I/O or model calls.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type { ImageClassificationResult } from "./classification";
import type { ImagingIntakeRecord } from "./intake";
import type { ImageProtocolEvaluation } from "./protocol";
import type { ImageQualityResult } from "./quality";

/** Source system identifier — IM-1 values preserved; IM-2 adds universal ingestion sources. */
export type ImagingOsSourceSystem =
  | "fi_os"
  | "hairaudit"
  | "hli"
  | "iiohr"
  | "external"
  | "patient_upload"
  | "consultation_os"
  | "surgery_os"
  | "manual_upload"
  | "unknown";

export type ImagingOsActorType = "patient" | "staff" | "system" | "external_client";

/** Actor type on universal ingestion requests (IM-2). */
export type ImagingOsUploadedByActorType = "patient" | "staff" | "clinician" | "system" | "unknown";

export type ImagingOsUploadSurface =
  | "fi_patient_profile"
  | "fi_consultation"
  | "fi_guided_protocol"
  | "hairaudit_case_upload"
  | "hli_intake"
  | "iiohr_portal"
  | "api"
  | "unknown"
  | "patient_portal"
  | "clinic_console"
  | "internal_api"
  | "case_gallery"
  | "consultation_form"
  | "surgery_workflow"
  | "audit_upload";

/** Full ImagingOS pipeline snapshot (stub/live orchestration target). */
export type ImagingOsAnalysisSnapshot = {
  intake: ImagingIntakeRecord;
  quality: ImageQualityResult;
  protocol: ImageProtocolEvaluation;
  classification: ImageClassificationResult;
};

export type { CanonicalHairImageCategory };
