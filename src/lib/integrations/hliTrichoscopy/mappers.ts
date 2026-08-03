/**
 * Map HLI trichoscopy statuses onto FiOS canonical statuses (versioned).
 */

import type { FiosTrichoscopyReadiness, FiosTrichoscopyStatus } from "./types";

export const HLI_TO_FIOS_STATUS_MAP_VERSION = "1a.1";

const STATUS_MAP: Record<string, FiosTrichoscopyStatus> = {
  not_requested: "not_requested",
  requested: "requested",
  created: "requested",
  linked: "linked",
  capture_due: "capture_due",
  session_created: "capture_due",
  capture_in_progress: "capture_in_progress",
  capturing: "capture_in_progress",
  session_captured: "capture_complete",
  capture_complete: "capture_complete",
  capture_quality_assessed: "capture_complete",
  analysis_pending: "analysis_pending",
  analysis_ready: "review_pending",
  review_pending: "review_pending",
  observation_confirmed: "confirmed",
  metric_confirmed: "confirmed",
  confirmed: "confirmed",
  confirmed_with_limitations: "confirmed_with_limitations",
  comparison_ready: "confirmed",
  longitudinal_change_confirmed: "confirmed",
  response_assessment_confirmed: "confirmed",
  surgical_evidence_ready: "confirmed",
  patient_report_published: "completed",
  repeat_capture_required: "repeat_capture_required",
  repeat_capture_requested: "repeat_capture_required",
  medical_review_required: "medical_review_required",
  medical_review_requested: "medical_review_required",
  completed: "completed",
  cancelled: "cancelled",
  error: "integration_error",
  integration_error: "integration_error",
};

export function mapHliTrichoscopyStatusToFios(
  hliStatus: string | null | undefined
): FiosTrichoscopyStatus {
  const key = String(hliStatus ?? "")
    .trim()
    .toLowerCase();
  if (!key) return "integration_error";
  return STATUS_MAP[key] ?? "integration_error";
}

export function mapEventTypeToFiosStatus(eventType: string): FiosTrichoscopyStatus | null {
  const t = String(eventType ?? "")
    .trim()
    .toLowerCase()
    .replace(/^trichoscopy\./, "");
  return STATUS_MAP[t] ?? null;
}

export function resolveFiosTrichoscopyReadiness(opts: {
  status: FiosTrichoscopyStatus | null | undefined;
  required?: boolean;
}): FiosTrichoscopyReadiness {
  const status = opts.status ?? "not_requested";
  if (!opts.required && status === "not_requested") {
    return { state: "not_required", blocking: false, blockingReasonCodes: [] };
  }

  switch (status) {
    case "not_requested":
      return {
        state: "required_not_started",
        blocking: Boolean(opts.required),
        blockingReasonCodes: opts.required ? ["trichoscopy_not_started"] : [],
        nextAction: "request_trichoscopy",
      };
    case "requested":
    case "linked":
    case "capture_due":
    case "capture_in_progress":
      return {
        state: "capture_incomplete",
        blocking: Boolean(opts.required),
        blockingReasonCodes: ["trichoscopy_capture_incomplete"],
        nextAction: "complete_trichoscopy_capture",
      };
    case "capture_complete":
    case "analysis_pending":
      return {
        state: "analysis_pending",
        blocking: Boolean(opts.required),
        blockingReasonCodes: ["trichoscopy_analysis_pending"],
        nextAction: "await_analysis",
      };
    case "review_pending":
      return {
        state: "clinical_review_pending",
        blocking: Boolean(opts.required),
        blockingReasonCodes: ["trichoscopy_review_pending"],
        nextAction: "review_trichoscopy_evidence",
      };
    case "confirmed":
      return { state: "confirmed", blocking: false, blockingReasonCodes: [] };
    case "confirmed_with_limitations":
      return {
        state: "confirmed_with_limitations",
        blocking: false,
        blockingReasonCodes: ["trichoscopy_limitations"],
        nextAction: "review_limitations",
      };
    case "repeat_capture_required":
      return {
        state: "repeat_capture_required",
        blocking: Boolean(opts.required),
        blockingReasonCodes: ["trichoscopy_repeat_capture"],
        nextAction: "repeat_trichoscopy_capture",
      };
    case "medical_review_required":
      return {
        state: "medical_review_required",
        blocking: true,
        blockingReasonCodes: ["trichoscopy_medical_review"],
        nextAction: "review_trichoscopy_medical_flag",
      };
    case "integration_error":
      return {
        state: "integration_error",
        blocking: false,
        blockingReasonCodes: ["trichoscopy_integration_error"],
        nextAction: "resolve_trichoscopy_sync_error",
      };
    case "completed":
    case "cancelled":
      return { state: "confirmed", blocking: false, blockingReasonCodes: [] };
    default:
      return {
        state: "required_not_started",
        blocking: Boolean(opts.required),
        blockingReasonCodes: [],
      };
  }
}

export function buildTrichoscopyRequestIdempotencyKey(opts: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  purpose: string;
  workflowReference?: string | null;
}): string {
  const parts = [
    opts.tenantId.trim(),
    opts.patientId.trim(),
    (opts.caseId ?? "").trim() || "-",
    opts.purpose.trim(),
    (opts.workflowReference ?? "").trim() || "-",
  ];
  return parts.join(":");
}
