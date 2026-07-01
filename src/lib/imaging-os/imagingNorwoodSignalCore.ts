/**
 * ImagingOS Phase 7 — optional live Norwood staff signal (feature-flagged).
 * Staff-facing only; never patient-facing diagnosis.
 */

import { CLINICAL_REVIEW_CONFIDENCE_THRESHOLD } from "./clinicalImageAnalysisCore";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";
import type { ImagingJobSummariesMetadata } from "./imagingJobReadOnlySummaries";
import type { OutcomeSignalProvider } from "./imagingOutcomeSignalsCore";

export const IMAGINGOS_NORWOOD_SIGNAL_VERSION = "imagingos_norwood_signal_v1" as const;

export type NorwoodSignalSummaryStatus = "complete" | "needs_review" | "unavailable";

export type NorwoodSignalSummary = {
  summary_status: NorwoodSignalSummaryStatus;
  confidence: number;
  observations: string[];
  review_required: boolean;
  limitations: string[];
  provider: OutcomeSignalProvider;
  summary_version: typeof IMAGINGOS_NORWOOD_SIGNAL_VERSION;
  generated_at: string;
};

const STAFF_LIMITATIONS = [
  "Staff review only",
  "Not a diagnosis",
  "Requires clinician confirmation",
] as const;

const RECIPIENT_VIEWS = ["front", "top", "crown", "recipient", "hairline", "vertex"];

export function parseImagingNorwoodProviderFlag(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.FI_IMAGING_ENABLE_LIVE_NORWOOD_PROVIDER === "true";
}

export function buildUnavailableNorwoodSignal(input: {
  limitations: string[];
  observations?: string[];
  provider?: OutcomeSignalProvider;
  generatedAt?: string;
}): NorwoodSignalSummary {
  return {
    summary_status: "unavailable",
    confidence: 0,
    observations: input.observations ?? [],
    review_required: true,
    limitations: input.limitations,
    provider: input.provider ?? "unavailable",
    summary_version: IMAGINGOS_NORWOOD_SIGNAL_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function buildNorwoodSignalSummary(input: {
  summary_status: NorwoodSignalSummaryStatus;
  confidence: number;
  observations: string[];
  limitations?: string[];
  provider: OutcomeSignalProvider;
  generatedAt?: string;
}): NorwoodSignalSummary {
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
    limitations: input.limitations ?? [...STAFF_LIMITATIONS],
    provider: input.provider,
    summary_version: IMAGINGOS_NORWOOD_SIGNAL_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
  };
}

export function mergeNorwoodSignalMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  summary: NorwoodSignalSummary
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
    imaging_job_summaries: { ...current, norwood_grade: summary },
  };
}

export type LiveNorwoodSignalInput = {
  metadata: Record<string, unknown>;
  aiImageCategory?: string | null;
  aiImageCategoryConfidence?: number | null;
  liveEnabled: boolean;
  providerAvailable: boolean;
  providerName: OutcomeSignalProvider;
};

export function buildLiveNorwoodSignalSummary(input: LiveNorwoodSignalInput): NorwoodSignalSummary {
  if (!input.liveEnabled) {
    return buildUnavailableNorwoodSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Live Norwood provider is disabled (FI_IMAGING_ENABLE_LIVE_NORWOOD_PROVIDER=false).",
      ],
      observations: ["Enable the live Norwood feature flag for staff signal generation."],
      provider: "unavailable",
    });
  }

  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const viewType = String(clinical?.view_type ?? input.aiImageCategory ?? "").toLowerCase();
  const isRecipientContext = RECIPIENT_VIEWS.some((v) => viewType.includes(v));

  if (!isRecipientContext) {
    return buildUnavailableNorwoodSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Norwood staff signal requires frontal, top, or crown recipient views.",
      ],
      observations: ["Current view is not suitable for recipient pattern staff review."],
      provider: input.providerName,
    });
  }

  if (!input.providerAvailable) {
    return buildUnavailableNorwoodSignal({
      limitations: [
        ...STAFF_LIMITATIONS,
        "Live Norwood provider is enabled but unavailable for this image.",
      ],
      observations: ["Provider could not produce a pattern staff signal — manual review recommended."],
      provider: "unavailable",
    });
  }

  const confidence = clinical?.recipient_assessment?.confidence ?? input.aiImageCategoryConfidence ?? 0;
  const observations: string[] = [];
  if (clinical?.recipient_assessment?.observations?.length) {
    observations.push(
      ...clinical.recipient_assessment.observations
        .filter((o) => !/\bnorwood\b/i.test(o) && !/\bludwig\b/i.test(o))
        .slice(0, 3)
    );
  }
  if (observations.length === 0) {
    observations.push("Recipient-area capture identified for staff pattern review.");
  }

  const summary_status =
    confidence >= CLINICAL_REVIEW_CONFIDENCE_THRESHOLD ? "complete" : "needs_review";

  return buildNorwoodSignalSummary({
    summary_status,
    confidence,
    observations,
    limitations: [...STAFF_LIMITATIONS],
    provider: input.providerName,
  });
}