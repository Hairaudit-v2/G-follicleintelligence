import { getVieProtocol } from "./vieProtocolCatalog";
import type { VieComparisonConfidenceBand } from "./vieComparisonTypes";
import { compareJourneyStages } from "./vieLongitudinalComparisonCore";
import {
  VIE_ALIGNMENT_ENGINE_VERSION,
  type VieAlignmentCaptureInput,
  type VieAlignmentReferenceCandidate,
  type VieAlignmentStatus,
  type VieCaptureOrientation,
  type VieCaptureReferenceGuidance,
  type VieCaptureStandardizationMetadata,
  type ViePatientTwinAlignmentSummary,
  type VieSameAngleAlignmentResult,
} from "./vieAlignmentTypes";

const BASELINE_STAGES = new Set(["baseline", "consultation", "planning"]);

const DISTANCE_HINT_GROUPS: Record<string, string> = {
  "arm's length": "medium",
  "arms length": "medium",
  "arm length": "medium",
  "medium distance": "medium",
  close: "close",
  "close-up": "close",
  closeup: "close",
  "very close": "close",
  macro: "close",
  wide: "wide",
  overview: "wide",
};

export function deriveCaptureOrientation(
  width: number | null,
  height: number | null
): VieCaptureOrientation {
  if (!width || !height || width <= 0 || height <= 0) return "unknown";
  const ratio = width / height;
  if (ratio > 1.15) return "landscape";
  if (ratio < 0.87) return "portrait";
  return "square";
}

export function normalizeDistanceHint(hint: string | null | undefined): string | null {
  if (!hint?.trim()) return null;
  const s = hint.trim().toLowerCase();
  for (const [key, group] of Object.entries(DISTANCE_HINT_GROUPS)) {
    if (s.includes(key)) return group;
  }
  if (s.includes("close")) return "close";
  if (s.includes("arm") || s.includes("medium")) return "medium";
  if (s.includes("wide") || s.includes("overview")) return "wide";
  return s;
}

export function captureDistanceHintForSlot(protocolSlug: string, slotSlug: string): string | null {
  const slot = getVieProtocol(protocolSlug)?.slots.find((s) => s.slug === slotSlug);
  return slot?.capture_distance_hint ?? null;
}

export function captureGuideForSlot(protocolSlug: string, slotSlug: string) {
  const slot = getVieProtocol(protocolSlug)?.slots.find((s) => s.slug === slotSlug);
  return slot?.capture_guide ?? null;
}

function isBaselineStage(stage: string): boolean {
  return BASELINE_STAGES.has(stage);
}

function captureTimestampMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function daysBetween(referenceAt: string, captureAt: string): number {
  const diff = captureTimestampMs(captureAt) - captureTimestampMs(referenceAt);
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function slotLabel(protocolSlug: string, slotSlug: string): string {
  const slot = getVieProtocol(protocolSlug)?.slots.find((s) => s.slug === slotSlug);
  return slot?.label ?? slotSlug.replace(/_/g, " ");
}

function matchesReferenceCriteria(
  candidate: VieAlignmentReferenceCandidate,
  capture: VieAlignmentCaptureInput
): boolean {
  if (candidate.image_id === capture.image_id) return false;
  if (candidate.patient_id !== capture.patient_id) return false;
  if (candidate.anatomical_region !== capture.anatomical_region) return false;
  if (candidate.slot_family !== capture.slot_family) return false;
  if (candidate.framing !== capture.framing) return false;
  return true;
}

/**
 * Select best historical reference: same patient/region/slot_family/framing, accepted only.
 * Prefer highest quality; tie-break toward earliest baseline capture.
 */
export function selectBestReferenceImage(
  candidates: VieAlignmentReferenceCandidate[],
  capture: VieAlignmentCaptureInput
): VieAlignmentReferenceCandidate | null {
  const matching = candidates.filter((c) => matchesReferenceCriteria(c, capture));
  if (matching.length === 0) return null;

  const sorted = [...matching].sort((a, b) => {
    const aBaseline = isBaselineStage(a.journey_stage);
    const bBaseline = isBaselineStage(b.journey_stage);
    if (aBaseline !== bBaseline) return aBaseline ? -1 : 1;

    if (b.quality_score !== a.quality_score) return b.quality_score - a.quality_score;

    if (aBaseline && bBaseline) {
      const stageCmp = compareJourneyStages(a.journey_stage, b.journey_stage);
      if (stageCmp !== 0) return stageCmp;
      return captureTimestampMs(a.captured_at) - captureTimestampMs(b.captured_at);
    }

    return captureTimestampMs(a.captured_at) - captureTimestampMs(b.captured_at);
  });

  return sorted[0] ?? null;
}

function scoreFramingMatch(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  return capture.framing === reference.framing ? 20 : 0;
}

function scoreOrientationMatch(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  if (capture.orientation === "unknown" || reference.orientation === "unknown") return 8;
  return capture.orientation === reference.orientation ? 15 : 0;
}

function scoreDistanceConsistency(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  const a = normalizeDistanceHint(capture.capture_distance_hint);
  const b = normalizeDistanceHint(reference.capture_distance_hint);
  if (!a || !b) return 8;
  if (a === b) return 15;
  if ((a === "medium" && b === "wide") || (a === "wide" && b === "medium")) return 8;
  return 0;
}

function scoreProtocolSlotMatch(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  return capture.protocol_slot_slug === reference.protocol_slot_slug ? 15 : 5;
}

function scoreVisitTypeConsistency(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  if (!capture.visit_type || !reference.visit_type) return 5;
  return capture.visit_type === reference.visit_type ? 10 : 0;
}

function scoreDimensionSimilarity(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  const cw = capture.image_width;
  const ch = capture.image_height;
  const rw = reference.image_width;
  const rh = reference.image_height;
  if (!cw || !ch || !rw || !rh) return 8;

  const captureRatio = cw / ch;
  const refRatio = rw / rh;
  const ratioDelta = Math.abs(captureRatio - refRatio);
  const ratioScore = Math.max(0, 10 - ratioDelta * 20);

  const captureArea = cw * ch;
  const refArea = rw * rh;
  const areaRatio = Math.min(captureArea, refArea) / Math.max(captureArea, refArea);
  const areaScore = areaRatio * 5;

  return Math.round(ratioScore + areaScore);
}

function scoreQualityConsistency(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate
): number {
  const delta = Math.abs(capture.quality_score - reference.quality_score);
  if (delta <= 5) return 10;
  if (delta <= 15) return 7;
  if (delta <= 25) return 4;
  return 0;
}

function deriveAlignmentStatus(
  score: number
): Exclude<VieAlignmentStatus, "no_reference_available"> {
  if (score >= 85) return "excellent";
  if (score >= 70) return "acceptable";
  if (score >= 50) return "poor";
  return "retake_recommended";
}

function deriveConfidenceBand(score: number, warnings: string[]): VieComparisonConfidenceBand {
  let adjusted = score;
  adjusted -= warnings.length * 8;
  if (adjusted >= 75) return "high";
  if (adjusted >= 50) return "medium";
  return "low";
}

function buildAlignmentWarnings(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate,
  components: {
    framing: number;
    orientation: number;
    distance: number;
    slot: number;
    visit: number;
    dimensions: number;
    quality: number;
  }
): string[] {
  const warnings: string[] = [];

  if (components.framing < 20) warnings.push("framing mismatch detected");
  if (components.orientation < 12) warnings.push("orientation differs from baseline");
  if (components.distance < 10) {
    const closer =
      normalizeDistanceHint(capture.capture_distance_hint) === "close" &&
      normalizeDistanceHint(reference.capture_distance_hint) !== "close";
    const farther =
      normalizeDistanceHint(capture.capture_distance_hint) === "wide" &&
      normalizeDistanceHint(reference.capture_distance_hint) !== "wide";
    if (closer) warnings.push("camera slightly closer than baseline");
    else if (farther) warnings.push("camera slightly farther than baseline");
    else warnings.push("capture distance inconsistent with baseline");
  }
  if (components.slot < 15) warnings.push("protocol slot differs from reference capture");
  if (components.visit < 8) warnings.push("visit type differs from baseline");
  if (components.dimensions < 10) warnings.push("image dimensions differ from baseline");
  if (components.quality < 6) warnings.push("quality score diverges from baseline");

  return warnings;
}

export function evaluateSameAngleAlignment(
  capture: VieAlignmentCaptureInput,
  reference: VieAlignmentReferenceCandidate | null
): VieSameAngleAlignmentResult {
  if (!reference) {
    return {
      engine_version: VIE_ALIGNMENT_ENGINE_VERSION,
      alignment_score: 0,
      alignment_status: "no_reference_available",
      confidence_band: "low",
      warnings: [],
      reference_image_id: null,
      reference_captured_at: null,
      reference_slot_label: null,
      days_since_reference: null,
      angle_match_status: "pending_ai_vision",
      metadata: { reason: "no_historical_reference" },
    };
  }

  const components = {
    framing: scoreFramingMatch(capture, reference),
    orientation: scoreOrientationMatch(capture, reference),
    distance: scoreDistanceConsistency(capture, reference),
    slot: scoreProtocolSlotMatch(capture, reference),
    visit: scoreVisitTypeConsistency(capture, reference),
    dimensions: scoreDimensionSimilarity(capture, reference),
    quality: scoreQualityConsistency(capture, reference),
  };

  const alignment_score = Math.max(
    0,
    Math.min(
      100,
      components.framing +
        components.orientation +
        components.distance +
        components.slot +
        components.visit +
        components.dimensions +
        components.quality
    )
  );

  const warnings = buildAlignmentWarnings(capture, reference, components);
  const alignment_status = deriveAlignmentStatus(alignment_score);

  return {
    engine_version: VIE_ALIGNMENT_ENGINE_VERSION,
    alignment_score,
    alignment_status,
    confidence_band: deriveConfidenceBand(alignment_score, warnings),
    warnings,
    reference_image_id: reference.image_id,
    reference_captured_at: reference.captured_at,
    reference_slot_label: slotLabel(reference.protocol_template_slug, reference.protocol_slot_slug),
    days_since_reference: daysBetween(reference.captured_at, capture.captured_at),
    angle_match_status: "pending_ai_vision",
    metadata: {
      score_components: components,
      reference_journey_stage: reference.journey_stage,
      capture_journey_stage: capture.journey_stage,
    },
  };
}

export function buildCaptureStandardizationMetadata(
  capture: VieAlignmentCaptureInput,
  alignment: VieSameAngleAlignmentResult
): VieCaptureStandardizationMetadata {
  return {
    framing: capture.framing,
    capture_distance_hint: capture.capture_distance_hint,
    orientation: capture.orientation,
    alignment_score:
      alignment.alignment_status === "no_reference_available" ? null : alignment.alignment_score,
    reference_image_id: alignment.reference_image_id,
  };
}

export function buildCaptureReferenceGuidance(
  reference: VieAlignmentReferenceCandidate | null,
  captureAt?: string
): VieCaptureReferenceGuidance {
  if (!reference) {
    return {
      has_reference: false,
      reference_image_id: null,
      reference_slot_label: null,
      days_since_reference: null,
      framing: null,
      capture_distance_hint: null,
      orientation: null,
    };
  }

  const now = captureAt ?? new Date().toISOString();

  return {
    has_reference: true,
    reference_image_id: reference.image_id,
    reference_slot_label: slotLabel(reference.protocol_template_slug, reference.protocol_slot_slug),
    days_since_reference: daysBetween(reference.captured_at, now),
    framing: reference.framing,
    capture_distance_hint: reference.capture_distance_hint,
    orientation: reference.orientation,
  };
}

const POOR_ALIGNMENT_STATUSES = new Set<VieAlignmentStatus>(["poor", "retake_recommended"]);

export function isStandardizedEvidence(
  alignmentStatus: VieAlignmentStatus | null,
  alignmentScore: number | null
): boolean {
  if (!alignmentStatus || alignmentStatus === "no_reference_available") return false;
  if (POOR_ALIGNMENT_STATUSES.has(alignmentStatus)) return false;
  return (alignmentScore ?? 0) >= 70;
}

export function buildPatientTwinAlignmentSummary(
  results: Array<{
    anatomical_region: string;
    slot_family: string;
    alignment_score: number;
    alignment_status: VieAlignmentStatus;
    protocol_slot_slug?: string;
    protocol_template_slug?: string;
  }>
): ViePatientTwinAlignmentSummary {
  const scored = results.filter((r) => r.alignment_status !== "no_reference_available");
  const alignment_consistency_score =
    scored.length > 0
      ? Math.round(scored.reduce((sum, r) => sum + r.alignment_score, 0) / scored.length)
      : 0;

  const poorRegions = new Set<string>();
  for (const r of scored) {
    if (POOR_ALIGNMENT_STATUSES.has(r.alignment_status)) {
      poorRegions.add(r.anatomical_region);
    }
  }

  const standardizedCount = scored.filter((r) =>
    isStandardizedEvidence(r.alignment_status, r.alignment_score)
  ).length;
  const standardized_evidence_coverage_percent =
    scored.length > 0 ? Math.round((standardizedCount / scored.length) * 100) : 0;

  const worst = [...scored]
    .filter((r) => POOR_ALIGNMENT_STATUSES.has(r.alignment_status))
    .sort((a, b) => a.alignment_score - b.alignment_score)[0];

  return {
    alignment_consistency_score,
    regions_with_poor_consistency: [...poorRegions].sort(),
    standardized_evidence_coverage_percent,
    next_recommended_standardized_recapture: worst
      ? {
          slot_slug: worst.protocol_slot_slug ?? null,
          slot_label:
            worst.protocol_template_slug && worst.protocol_slot_slug
              ? slotLabel(worst.protocol_template_slug, worst.protocol_slot_slug)
              : null,
          anatomical_region: worst.anatomical_region,
          reason: `Poor alignment (${worst.alignment_score}%) — recapture to match baseline framing`,
        }
      : {
          slot_slug: null,
          slot_label: null,
          anatomical_region: null,
          reason: null,
        },
  };
}

export function formatReferenceComparisonLabel(
  referenceSlotLabel: string | null,
  daysSinceReference: number | null
): string | null {
  if (!referenceSlotLabel || daysSinceReference == null) return null;
  return `Previous ${referenceSlotLabel.toLowerCase()} image found (${daysSinceReference} day${daysSinceReference === 1 ? "" : "s"} ago)`;
}
