/**
 * ImagingOS Phase 4 — conservative read-only staff summaries for queued AI job kinds.
 * Not clinical decisions; staff-facing observations only.
 */

import { CLINICAL_REVIEW_CONFIDENCE_THRESHOLD } from "./clinicalImageAnalysisCore";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";

export const IMAGINGOS_JOB_SUMMARY_VERSION = "imagingos_job_summary_v1" as const;

export type ReadOnlyJobSummaryStatus = "complete" | "needs_review" | "unavailable";

export type ReadOnlyJobSummary = {
  summary_status: ReadOnlyJobSummaryStatus;
  confidence: number;
  observations: string[];
  review_required: boolean;
  limitations: string[];
  summary_version: typeof IMAGINGOS_JOB_SUMMARY_VERSION;
  generated_at: string;
};

export type ImagingJobSummariesMetadata = {
  density_estimate?: ReadOnlyJobSummary;
  norwood_grade?: ReadOnlyJobSummary;
  outcome_score?: ReadOnlyJobSummary;
};

const OUTCOME_SCORE_STAFF_LIMITATIONS = [
  "Not a predictive simulation",
  "For staff review only",
] as const;

export function buildUnavailableJobSummary(input: {
  limitations: string[];
  observations?: string[];
  generatedAt?: string;
}): ReadOnlyJobSummary {
  return {
    summary_status: "unavailable",
    confidence: 0,
    observations: input.observations ?? [],
    review_required: true,
    limitations: input.limitations,
    summary_version: IMAGINGOS_JOB_SUMMARY_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function buildReadOnlyJobSummary(input: {
  summary_status: ReadOnlyJobSummaryStatus;
  confidence: number;
  observations: string[];
  limitations?: string[];
  generatedAt?: string;
}): ReadOnlyJobSummary {
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const review_required =
    input.summary_status === "needs_review" ||
    input.summary_status === "unavailable" ||
    confidence < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD;
  return {
    summary_status: input.summary_status,
    confidence,
    observations: input.observations.filter(Boolean).slice(0, 12),
    review_required,
    limitations: input.limitations ?? [],
    summary_version: IMAGINGOS_JOB_SUMMARY_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function mergeImagingJobSummariesMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  patch: ImagingJobSummariesMetadata
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  const current =
    base.imaging_job_summaries &&
    typeof base.imaging_job_summaries === "object" &&
    !Array.isArray(base.imaging_job_summaries)
      ? (base.imaging_job_summaries as ImagingJobSummariesMetadata)
      : {};
  return {
    ...base,
    imaging_job_summaries: { ...current, ...patch },
  };
}

export function readImagingJobSummaries(
  metadata: Record<string, unknown> | null | undefined
): ImagingJobSummariesMetadata {
  const raw = metadata?.imaging_job_summaries;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ImagingJobSummariesMetadata;
}

export function buildDensityEstimateSummary(input: {
  metadata: Record<string, unknown>;
  aiImageCategory?: string | null;
  aiImageCategoryConfidence?: number | null;
}): ReadOnlyJobSummary {
  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const viewType = clinical?.view_type ?? input.aiImageCategory ?? null;
  const donorHints = ["donor", "microscopic", "trichoscopy"];
  const isDonorContext =
    viewType != null && donorHints.some((h) => String(viewType).toLowerCase().includes(h));

  if (!isDonorContext) {
    return buildUnavailableJobSummary({
      limitations: [
        "Automated density estimate is not available for this view type.",
        "Staff should use donor-area images for density observations.",
        "This is a staff summary only — not a clinical diagnosis.",
      ],
      observations: ["Density estimate requires a donor or microscopic donor-context image."],
    });
  }

  const confidence = clinical?.donor_assessment?.confidence ?? input.aiImageCategoryConfidence ?? 0;
  if (confidence < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD) {
    return buildReadOnlyJobSummary({
      summary_status: "needs_review",
      confidence,
      observations: [
        "Donor-context image identified; automated density band estimate is not yet available.",
        ...(clinical?.donor_assessment?.observations?.slice(0, 2) ?? []),
      ],
      limitations: [
        "Live density modelling is not enabled in this phase.",
        "Use donor assessment observations for staff review only.",
      ],
    });
  }

  return buildReadOnlyJobSummary({
    summary_status: "needs_review",
    confidence,
    observations: [
      "Donor-context capture suitable for staff density review.",
      ...(clinical?.donor_assessment?.observations?.slice(0, 3) ?? []),
    ],
    limitations: [
      "Numeric density values are not produced in this phase.",
      "Staff review recommended before planning use.",
    ],
  });
}

export function buildNorwoodGradeSummary(input: {
  metadata: Record<string, unknown>;
  patientNorwoodScale?: string | null;
  aiImageCategoryConfidence?: number | null;
}): ReadOnlyJobSummary {
  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const recipientViews = ["front", "top", "crown", "recipient", "hairline", "vertex"];
  const viewType = String(clinical?.view_type ?? "").toLowerCase();
  const isRecipientContext = recipientViews.some((v) => viewType.includes(v));

  if (!isRecipientContext) {
    return buildUnavailableJobSummary({
      limitations: [
        "Norwood-style grading summary requires frontal, top, or crown recipient views.",
        "Not a diagnosis — staff planning aid only.",
      ],
      observations: ["Current view is not suitable for hair-loss pattern summary."],
    });
  }

  const patientScale = input.patientNorwoodScale?.trim();
  const confidence = clinical?.recipient_assessment?.confidence ?? input.aiImageCategoryConfidence ?? 0;

  if (patientScale) {
    return buildReadOnlyJobSummary({
      summary_status: confidence >= CLINICAL_REVIEW_CONFIDENCE_THRESHOLD ? "complete" : "needs_review",
      confidence: Math.max(confidence, 0.5),
      observations: [
        `Patient record includes Norwood scale: ${patientScale}.`,
        "Image view aligns with recipient-area documentation.",
        ...(clinical?.recipient_assessment?.observations?.slice(0, 2) ?? []),
      ],
      limitations: [
        "Automated Norwood grading from this image alone is not enabled.",
        "Recorded patient scale should be verified by staff.",
      ],
    });
  }

  return buildReadOnlyJobSummary({
    summary_status: "needs_review",
    confidence,
    observations: [
      "Recipient-area view captured; no Norwood scale on patient record.",
      "Staff should confirm pattern documentation separately.",
    ],
    limitations: [
      "Live Norwood grading from vision is not available in this phase.",
      "Do not present to patients as a diagnosis.",
    ],
  });
}

/**
 * Conservative staff outcome summary — not predictive surgery simulation.
 * Returns unavailable when live outcome scoring is not supported.
 */
export function buildOutcomeScoreSummary(input: {
  metadata: Record<string, unknown>;
  providerSupported?: boolean;
  aiImageCategoryConfidence?: number | null;
}): ReadOnlyJobSummary {
  if (input.providerSupported === false) {
    return buildUnavailableJobSummary({
      limitations: [...OUTCOME_SCORE_STAFF_LIMITATIONS, "Outcome scoring provider is not enabled."],
      observations: ["Automated outcome scoring is not available for this image."],
    });
  }

  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const jobSummaries = readImagingJobSummaries(input.metadata);
  const hasPriorOutcome = Boolean(jobSummaries.outcome_score);
  const confidence = clinical?.confidence ?? input.aiImageCategoryConfidence ?? 0;

  if (!clinical && !hasPriorOutcome) {
    return buildUnavailableJobSummary({
      limitations: [...OUTCOME_SCORE_STAFF_LIMITATIONS],
      observations: [
        "Clinical image analysis is required before an outcome staff summary can be prepared.",
      ],
    });
  }

  const observations: string[] = [];
  if (clinical?.donor_assessment?.observations?.length) {
    observations.push(...clinical.donor_assessment.observations.slice(0, 2));
  }
  if (clinical?.recipient_assessment?.observations?.length) {
    observations.push(...clinical.recipient_assessment.observations.slice(0, 2));
  }
  if (observations.length === 0) {
    observations.push("Staff may compare this capture with prior longitudinal images.");
  }

  const summary_status =
    confidence >= CLINICAL_REVIEW_CONFIDENCE_THRESHOLD ? "complete" : "needs_review";

  return buildReadOnlyJobSummary({
    summary_status,
    confidence,
    observations,
    limitations: [...OUTCOME_SCORE_STAFF_LIMITATIONS],
  });
}

/** Ensures outcome summaries never use patient-facing diagnostic wording. */
/** Patient-facing diagnostic wording must not appear in staff observations. */
export function outcomeScoreSummaryIsStaffSafe(summary: ReadOnlyJobSummary): boolean {
  const forbidden = [/\bdiagnosis\b/i, /\bpredictive surgery\b/i, /patient-facing/i];
  const obsText = summary.observations.join(" ");
  return !forbidden.some((re) => re.test(obsText));
}