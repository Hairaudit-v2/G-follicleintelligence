/**
 * IMAGING-AI-GRAFT-PILOT-1 — pure graft tray count estimation + comparison logic.
 */

import { stubConfidenceFromSeed } from "./classification";
import type {
  GraftTrayAiReviewReason,
  GraftTrayCountComparison,
  GraftTrayCountEstimateResult,
  GraftTrayMismatchBand,
  ManualGraftCountSnapshot,
} from "./graftTrayCountTypes";

export type GraftTrayAiFeatureFlags = {
  enabled: boolean;
  provider: "stub" | "openai_vision";
  tolerancePercent: number;
};

const DEFAULT_TOLERANCE_PERCENT = 5;

export function parseGraftTrayAiFeatureFlags(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): GraftTrayAiFeatureFlags {
  const providerRaw = String(env.FI_IMAGING_GRAFT_TRAY_AI_PROVIDER ?? "stub")
    .trim()
    .toLowerCase();
  const toleranceRaw = Number(env.FI_IMAGING_GRAFT_TRAY_COUNT_TOLERANCE_PERCENT ?? DEFAULT_TOLERANCE_PERCENT);
  return {
    enabled: env.FI_IMAGING_ENABLE_GRAFT_TRAY_AI_COUNT === "true",
    provider: providerRaw === "openai_vision" ? "openai_vision" : "stub",
    tolerancePercent:
      Number.isFinite(toleranceRaw) && toleranceRaw >= 0
        ? Math.min(100, toleranceRaw)
        : DEFAULT_TOLERANCE_PERCENT,
  };
}

export function confidenceBandForScore(score: number): "high" | "medium" | "low" | "unknown" {
  if (!Number.isFinite(score)) return "unknown";
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

export function buildStubGraftTrayCountEstimate(input: {
  imageId: string;
  manualCount?: number | null;
}): GraftTrayCountEstimateResult {
  const seed = input.imageId.trim() || "graft-tray-stub";
  const confidence = stubConfidenceFromSeed(seed);
  const base = input.manualCount != null && input.manualCount > 0 ? input.manualCount : 120;
  const offset = Math.round((confidence - 0.5) * 20);
  const estimated = Math.max(0, base + offset);

  return {
    estimated_graft_count: estimated,
    confidence,
    confidence_band: confidenceBandForScore(confidence),
    image_quality: confidence >= 0.7 ? "suitable" : confidence >= 0.5 ? "marginal" : "insufficient",
    assessable: confidence >= 0.45,
    uncertainty_notes: [
      "Stub provider — deterministic estimate for pilot validation only.",
      "Not a clinical count. Staff review required.",
    ],
    provider: "stub",
    provider_version: "graft_tray_stub_v1",
    raw_provider_metadata: { mode: "stub", seed },
    recommended_review_reason: "graft_tray_ai_count_needs_review",
  };
}

export function buildUnableToAssessEstimate(input: {
  provider: GraftTrayCountEstimateResult["provider"];
  providerVersion: string;
  notes: string[];
}): GraftTrayCountEstimateResult {
  return {
    estimated_graft_count: null,
    confidence: 0,
    confidence_band: "unknown",
    image_quality: "insufficient",
    assessable: false,
    uncertainty_notes: input.notes,
    provider: input.provider,
    provider_version: input.providerVersion,
    raw_provider_metadata: { assessable: false },
    recommended_review_reason: "graft_tray_ai_unable_to_assess",
  };
}

export function resolveManualGraftCountFromEvents(input: {
  events: Array<{
    id: string;
    eventType: string;
    reviewStatus?: string | null;
    singles?: number | null;
    doubles?: number | null;
    triples?: number | null;
    multiples?: number | null;
    createdAt: string;
  }>;
  sessionExtractedGrafts?: number | null;
  graftSessionId?: string | null;
}): ManualGraftCountSnapshot {
  const confirmedTrays = input.events
    .filter((e) => e.eventType === "tray_count" && e.reviewStatus === "confirmed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (confirmedTrays.length > 0) {
    const latest = confirmedTrays[0];
    const latestCount =
      (latest.singles ?? 0) +
      (latest.doubles ?? 0) +
      (latest.triples ?? 0) +
      (latest.multiples ?? 0);
    return {
      manual_count: latestCount,
      manual_count_source: "confirmed_tray_latest",
      graft_count_event_id: latest.id,
      graft_session_id: input.graftSessionId ?? null,
    };
  }

  const totalConfirmed = confirmedTrays.reduce(
    (sum, e) =>
      sum + (e.singles ?? 0) + (e.doubles ?? 0) + (e.triples ?? 0) + (e.multiples ?? 0),
    0
  );
  if (totalConfirmed > 0) {
    return {
      manual_count: totalConfirmed,
      manual_count_source: "confirmed_tray_total",
      graft_count_event_id: confirmedTrays[confirmedTrays.length - 1]?.id ?? null,
      graft_session_id: input.graftSessionId ?? null,
    };
  }

  const extracted = input.sessionExtractedGrafts;
  if (extracted != null && extracted > 0) {
    return {
      manual_count: extracted,
      manual_count_source: "graft_session_extracted",
      graft_count_event_id: null,
      graft_session_id: input.graftSessionId ?? null,
    };
  }

  return {
    manual_count: null,
    manual_count_source: "missing",
    graft_count_event_id: null,
    graft_session_id: input.graftSessionId ?? null,
  };
}

export function compareGraftTrayAiEstimate(input: {
  estimate: GraftTrayCountEstimateResult;
  manual: ManualGraftCountSnapshot;
  tolerancePercent?: number;
}): GraftTrayCountComparison {
  const tolerance = input.tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT;
  const reasons: GraftTrayAiReviewReason[] = ["graft_tray_ai_count_needs_review"];

  if (!input.estimate.assessable) {
    return {
      mismatch_band: "image_not_assessable",
      delta: null,
      tolerance_percent: tolerance,
      review_reasons: ["graft_tray_ai_unable_to_assess", "graft_tray_ai_count_needs_review"],
    };
  }

  if (input.estimate.image_quality === "insufficient") {
    reasons.push("graft_tray_ai_quality_insufficient");
  }

  if (input.manual.manual_count_source === "missing" || input.manual.manual_count == null) {
    return {
      mismatch_band: "manual_count_missing",
      delta: null,
      tolerance_percent: tolerance,
      review_reasons: ["graft_tray_ai_manual_count_missing", ...reasons],
    };
  }

  const estimated = input.estimate.estimated_graft_count;
  if (estimated == null) {
    return {
      mismatch_band: "unable_to_assess",
      delta: null,
      tolerance_percent: tolerance,
      review_reasons: ["graft_tray_ai_unable_to_assess", ...reasons],
    };
  }

  const manual = input.manual.manual_count;
  const delta = estimated - manual;
  const pctDelta = manual > 0 ? (Math.abs(delta) / manual) * 100 : Math.abs(delta) > 0 ? 100 : 0;

  let band: GraftTrayMismatchBand = "within_tolerance";
  if (pctDelta <= tolerance) {
    band = "within_tolerance";
  } else if (pctDelta <= tolerance * 2) {
    band = "minor_mismatch";
    reasons.push("graft_tray_ai_manual_mismatch");
  } else {
    band = "material_mismatch";
    reasons.push("graft_tray_ai_material_mismatch", "graft_tray_ai_manual_mismatch");
  }

  return {
    mismatch_band: band,
    delta,
    tolerance_percent: tolerance,
    review_reasons: [...new Set(reasons)],
  };
}

export function mapReviewActionToStatus(
  action: import("./graftTrayCountTypes").GraftTrayAiReviewAction
): import("./graftTrayCountTypes").GraftTrayAiReviewStatus {
  switch (action) {
    case "accept_ai_estimate":
      return "accepted_ai";
    case "accept_manual_count":
      return "accepted_manual";
    case "correct_count":
      return "corrected";
    case "reject_ai_estimate":
      return "rejected_ai";
    case "request_retake":
      return "retake_requested";
    default:
      return "pending_review";
  }
}