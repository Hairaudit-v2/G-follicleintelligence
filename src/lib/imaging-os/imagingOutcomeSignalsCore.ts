/**
 * ImagingOS Phase 6 — optional live density/outcome staff signals (feature-flagged).
 * Staff-facing only; not patient diagnosis or predictive simulation.
 */

import { CLINICAL_REVIEW_CONFIDENCE_THRESHOLD } from "./clinicalImageAnalysisCore";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";
import type { ImagingJobSummariesMetadata } from "./imagingJobReadOnlySummaries";

export const IMAGINGOS_OUTCOME_SIGNALS_VERSION = "imagingos_outcome_signals_v1" as const;

export type OutcomeSignalProvider = "hli_vision" | "stub" | "unavailable";

export type OutcomeSignalSummaryStatus = "complete" | "needs_review" | "unavailable";

export type OutcomeSignalSummary = {
  summary_status: OutcomeSignalSummaryStatus;
  confidence: number;
  observations: string[];
  review_required: boolean;
  limitations: string[];
  provider: OutcomeSignalProvider;
  summary_version: typeof IMAGINGOS_OUTCOME_SIGNALS_VERSION;
  generated_at: string;
};

const STAFF_LIMITATIONS = [
  "Not a predictive simulation",
  "For staff review only",
] as const;

export type ImagingLiveProviderFlags = {
  liveDensityEnabled: boolean;
  liveOutcomeEnabled: boolean;
};

export function parseImagingLiveProviderFlags(
  env: Record<string, string | undefined> = process.env
): ImagingLiveProviderFlags {
  return {
    liveDensityEnabled: env.FI_IMAGING_ENABLE_LIVE_DENSITY_PROVIDER === "true",
    liveOutcomeEnabled: env.FI_IMAGING_ENABLE_LIVE_OUTCOME_PROVIDER === "true",
  };
}

export function buildUnavailableOutcomeSignal(input: {
  limitations: string[];
  observations?: string[];
  provider?: OutcomeSignalProvider;
  generatedAt?: string;
}): OutcomeSignalSummary {
  return {
    summary_status: "unavailable",
    confidence: 0,
    observations: input.observations ?? [],
    review_required: true,
    limitations: input.limitations,
    provider: input.provider ?? "unavailable",
    summary_version: IMAGINGOS_OUTCOME_SIGNALS_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function buildOutcomeSignalSummary(input: {
  summary_status: OutcomeSignalSummaryStatus;
  confidence: number;
  observations: string[];
  limitations?: string[];
  provider: OutcomeSignalProvider;
  generatedAt?: string;
}): OutcomeSignalSummary {
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
    provider: input.provider,
    summary_version: IMAGINGOS_OUTCOME_SIGNALS_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function mergeOutcomeSignalsMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  patch: Partial<Pick<ImagingJobSummariesMetadata, "density_estimate" | "outcome_score">>
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

export type LiveDensitySignalInput = {
  metadata: Record<string, unknown>;
  aiImageCategory?: string | null;
  aiImageCategoryConfidence?: number | null;
  liveEnabled: boolean;
  providerAvailable: boolean;
  providerName: OutcomeSignalProvider;
};

export function buildLiveDensitySignalSummary(input: LiveDensitySignalInput): OutcomeSignalSummary {
  if (!input.liveEnabled) {
    return buildUnavailableOutcomeSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Live density provider is disabled (FI_IMAGING_ENABLE_LIVE_DENSITY_PROVIDER=false).",
      ],
      observations: ["Enable the live density feature flag for staff signal generation."],
      provider: "unavailable",
    });
  }

  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const viewType = clinical?.view_type ?? input.aiImageCategory ?? null;
  const donorHints = ["donor", "microscopic", "trichoscopy"];
  const isDonorContext =
    viewType != null && donorHints.some((h) => String(viewType).toLowerCase().includes(h));

  if (!isDonorContext) {
    return buildUnavailableOutcomeSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Density signal requires a donor or microscopic donor-context view.",
      ],
      observations: ["Current view is not suitable for donor density staff signal."],
      provider: input.providerName,
    });
  }

  if (!input.providerAvailable) {
    return buildUnavailableOutcomeSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Live density provider is enabled but unavailable for this image.",
      ],
      observations: ["Provider could not produce a density staff signal — manual review recommended."],
      provider: "unavailable",
    });
  }

  const confidence = clinical?.donor_assessment?.confidence ?? input.aiImageCategoryConfidence ?? 0;
  const observations: string[] = [];
  if (clinical?.donor_assessment?.observations?.length) {
    observations.push(...clinical.donor_assessment.observations.slice(0, 3));
  } else {
    observations.push("Donor-context capture identified for staff density review.");
  }

  const summary_status =
    confidence >= CLINICAL_REVIEW_CONFIDENCE_THRESHOLD ? "complete" : "needs_review";

  return buildOutcomeSignalSummary({
    summary_status,
    confidence,
    observations,
    limitations: [
      ...STAFF_LIMITATIONS,
      "Qualitative staff signal only — no numeric density diagnosis.",
    ],
    provider: input.providerName,
  });
}

export type LiveOutcomeScoreSignalInput = {
  metadata: Record<string, unknown>;
  aiImageCategoryConfidence?: number | null;
  liveEnabled: boolean;
  providerAvailable: boolean;
  providerName: OutcomeSignalProvider;
};

export function buildLiveOutcomeScoreSignalSummary(
  input: LiveOutcomeScoreSignalInput
): OutcomeSignalSummary {
  if (!input.liveEnabled) {
    return buildUnavailableOutcomeSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Live outcome provider is disabled (FI_IMAGING_ENABLE_LIVE_OUTCOME_PROVIDER=false).",
      ],
      observations: ["Enable the live outcome feature flag for staff signal generation."],
      provider: "unavailable",
    });
  }

  const clinical = readImagingClinicalAiMetadata(input.metadata);
  if (!clinical) {
    return buildUnavailableOutcomeSignal({
      limitations: [...STAFF_LIMITATIONS],
      observations: [
        "Clinical image analysis is required before a live outcome staff signal can be prepared.",
      ],
      provider: input.providerName,
    });
  }

  if (!input.providerAvailable) {
    return buildUnavailableOutcomeSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Live outcome provider is enabled but unavailable for this image.",
      ],
      observations: ["Provider could not produce an outcome staff signal — manual review recommended."],
      provider: "unavailable",
    });
  }

  const confidence = clinical.confidence ?? input.aiImageCategoryConfidence ?? 0;
  const observations: string[] = [];
  if (clinical.donor_assessment?.observations?.length) {
    observations.push(...clinical.donor_assessment.observations.slice(0, 2));
  }
  if (clinical.recipient_assessment?.observations?.length) {
    observations.push(...clinical.recipient_assessment.observations.slice(0, 2));
  }
  if (observations.length === 0) {
    observations.push("Staff may compare this capture with prior longitudinal images.");
  }

  const summary_status =
    confidence >= CLINICAL_REVIEW_CONFIDENCE_THRESHOLD ? "complete" : "needs_review";

  return buildOutcomeSignalSummary({
    summary_status,
    confidence,
    observations,
    limitations: [...STAFF_LIMITATIONS],
    provider: input.providerName,
  });
}

/** Patient-facing diagnostic wording must not appear in staff observations. */
export function outcomeSignalSummaryIsStaffSafe(summary: OutcomeSignalSummary): boolean {
  const forbidden = [/\bdiagnosis\b/i, /\bpredictive surgery\b/i, /patient-facing/i];
  const obsText = summary.observations.join(" ");
  return !forbidden.some((re) => re.test(obsText));
}