import { VIE_CAPTURE_POLICY_DEFAULTS } from "./vieCapturePolicy";
import { getVieProtocol } from "./vieProtocolCatalog";
import type { VieCaptureFraming, VieSurgeryPhase } from "./vieProtocolTypes";
import {
  VIE_COMPARISON_ENGINE_VERSION,
  type VieComparisonCaptureRecord,
  type VieComparisonCategory,
  type VieComparisonConfidenceBand,
  type VieComparisonPair,
  type VieComparisonReadinessSummary,
  type VieComparisonRecommendedUse,
  type VieFramingMatchStatus,
  type VieJourneyStage,
  type VieProgressionTimeline,
  type VieProgressionTimelineStage,
  type VieSurgeryComparisonStatus,
} from "./vieComparisonTypes";

const BASELINE_STAGES: ReadonlySet<VieJourneyStage> = new Set([
  "baseline",
  "consultation",
  "planning",
]);
const FOLLOW_UP_STAGES: ReadonlySet<VieJourneyStage> = new Set([
  "follow_up_3m",
  "follow_up_6m",
  "follow_up_9m",
  "follow_up_12m",
]);

const JOURNEY_STAGE_LABELS: Record<VieJourneyStage, string> = {
  baseline: "Baseline",
  consultation: "Consultation",
  planning: "Planning",
  surgery_day: "Surgery day",
  immediate_post_op: "Immediate post-op",
  follow_up_3m: "Follow-up ~3m",
  follow_up_6m: "Follow-up ~6m",
  follow_up_9m: "Follow-up ~9m",
  follow_up_12m: "Follow-up ~12m",
  repair_review: "Repair review",
};

const JOURNEY_STAGE_ORDER: Record<VieJourneyStage, number> = {
  baseline: 10,
  consultation: 20,
  planning: 30,
  surgery_day: 40,
  immediate_post_op: 50,
  follow_up_3m: 60,
  follow_up_6m: 70,
  follow_up_9m: 80,
  follow_up_12m: 90,
  repair_review: 35,
};

export function journeyStageLabel(stage: VieJourneyStage): string {
  return JOURNEY_STAGE_LABELS[stage];
}

export function compareJourneyStages(a: VieJourneyStage, b: VieJourneyStage): number {
  return JOURNEY_STAGE_ORDER[a] - JOURNEY_STAGE_ORDER[b];
}

/** Normalize protocol slot slug to a cross-protocol family key. */
export function deriveSlotFamily(slotSlug: string): string {
  let s = slotSlug.trim().toLowerCase();
  for (const prefix of ["pre_op_", "postop_", "fu_", "immediate_post_op_", "repair_"]) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length);
      break;
    }
  }
  if (s.endsWith("_close")) s = s.slice(0, -6);

  const synonyms: Record<string, string> = {
    front_hairline: "front",
    hairline_design: "front",
    healing_progress: "front",
    top_down: "top",
    donor_zone: "donor",
    donor_harvest: "donor",
    recipient_zone: "recipient",
    recipient_sites: "recipient",
    recipient_midscalp: "top",
    recipient_crown: "crown",
    problem_zone: "repair",
    plan_view: "repair",
    donor_status: "donor",
    graft_tray_overview: "graft_tray",
    graft_tray_close: "graft_tray",
    before_extraction: "donor",
    during_extraction: "donor",
    final_extraction: "donor",
    preop_marking: "front",
  };
  return synonyms[s] ?? s;
}

export function deriveSlotFraming(slotSlug: string, protocolSlug?: string): VieCaptureFraming {
  const catalogSlot = protocolSlug
    ? getVieProtocol(protocolSlug)?.slots.find((s) => s.slug === slotSlug)
    : null;
  if (catalogSlot) return catalogSlot.framing;
  const s = slotSlug.trim().toLowerCase();
  if (s.endsWith("_close") || s.includes("_close_")) return "close_up";
  return "overview";
}

export function parseFollowUpMonths(interval: string | null): number | null {
  if (!interval?.trim()) return null;
  const s = interval.trim().toLowerCase();
  const m1 = s.match(/(\d+)\s*m(?:onth)?/);
  if (m1) return Number(m1[1]);
  const m2 = s.match(/month[_-]?(\d+)/);
  if (m2) return Number(m2[1]);
  const m3 = s.match(/(\d+)/);
  if (m3) return Number(m3[1]);
  return null;
}

export function deriveJourneyStage(input: {
  protocol_template_slug: string;
  protocol_slot_slug: string;
  imaging_library_axis: string;
  follow_up_interval: string | null;
  visit_type: string | null;
}): VieJourneyStage {
  const protocol = input.protocol_template_slug.trim();
  const slot = input.protocol_slot_slug.trim();

  if (protocol === "repair_surgery_review") return "repair_review";
  if (protocol === "hair_transplant_planning") return "planning";
  if (protocol === "baseline_consultation") return "baseline";

  if (protocol === "full_clinical_head_series") {
    return input.imaging_library_axis === "consultation" ? "consultation" : "baseline";
  }

  if (protocol === "surgery_day") {
    const phase =
      getVieProtocol("surgery_day")?.slots.find((s) => s.slug === slot)?.surgery_phase ?? null;
    if (phase === "immediate_post_op") return "immediate_post_op";
    return "surgery_day";
  }

  if (protocol === "post_op_review") return "immediate_post_op";

  if (protocol === "follow_up_review") {
    const months = parseFollowUpMonths(input.follow_up_interval);
    if (months != null) {
      if (months >= 12) return "follow_up_12m";
      if (months >= 9) return "follow_up_9m";
      if (months >= 6) return "follow_up_6m";
    }
    return "follow_up_3m";
  }

  if (input.imaging_library_axis === "follow_up") return "follow_up_3m";
  if (input.imaging_library_axis === "surgery") return "surgery_day";
  return "consultation";
}

export function deriveSurgeryPhase(protocolSlug: string, slotSlug: string): VieSurgeryPhase | null {
  return (
    getVieProtocol(protocolSlug)?.slots.find((s) => s.slug === slotSlug)?.surgery_phase ?? null
  );
}

export function buildComparisonCaptureRecord(input: {
  patient_image_id: string;
  patient_id: string;
  case_id: string | null;
  anatomical_region: string | null;
  protocol_template_slug: string | null;
  protocol_slot_slug: string | null;
  quality_score: number;
  quality_band: string;
  clinically_usable: boolean;
  acceptance_status: VieComparisonCaptureRecord["acceptance_status"];
  captured_at: string;
  follow_up_interval: string | null;
  visit_type: string | null;
  imaging_library_axis: string;
}): VieComparisonCaptureRecord | null {
  const protocol = input.protocol_template_slug?.trim();
  const slot = input.protocol_slot_slug?.trim();
  if (!protocol || !slot) return null;

  const region = (input.anatomical_region?.trim() || "unknown").toLowerCase();
  const framing = deriveSlotFraming(slot, protocol);
  const slot_family = deriveSlotFamily(slot);

  return {
    patient_image_id: input.patient_image_id,
    patient_id: input.patient_id,
    case_id: input.case_id,
    anatomical_region: region,
    protocol_template_slug: protocol,
    protocol_slot_slug: slot,
    framing,
    slot_family,
    journey_stage: deriveJourneyStage({
      protocol_template_slug: protocol,
      protocol_slot_slug: slot,
      imaging_library_axis: input.imaging_library_axis,
      follow_up_interval: input.follow_up_interval,
      visit_type: input.visit_type,
    }),
    quality_score: input.quality_score,
    quality_band: input.quality_band,
    clinically_usable: input.clinically_usable,
    acceptance_status: input.acceptance_status,
    captured_at: input.captured_at,
    follow_up_interval: input.follow_up_interval,
    visit_type: input.visit_type,
    imaging_library_axis: input.imaging_library_axis,
    surgery_phase: deriveSurgeryPhase(protocol, slot),
  };
}

function captureTimestampMs(record: VieComparisonCaptureRecord): number {
  const ms = Date.parse(record.captured_at);
  return Number.isFinite(ms) ? ms : 0;
}

function daysBetween(
  before: VieComparisonCaptureRecord,
  after: VieComparisonCaptureRecord
): number {
  const diff = captureTimestampMs(after) - captureTimestampMs(before);
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function framingMatchStatus(
  a: VieComparisonCaptureRecord,
  b: VieComparisonCaptureRecord
): VieFramingMatchStatus {
  if (a.framing === b.framing) return "match";
  return "mismatch";
}

function isAdequateQuality(record: VieComparisonCaptureRecord, minimumScore: number): boolean {
  if (record.acceptance_status !== "accepted") return false;
  if (!record.clinically_usable) return false;
  return record.quality_score >= minimumScore;
}

function qualityWarnings(
  before: VieComparisonCaptureRecord,
  after: VieComparisonCaptureRecord,
  minimumScore: number
): string[] {
  const warnings: string[] = [];
  for (const [label, rec] of [
    ["Before", before],
    ["After", after],
  ] as const) {
    if (rec.quality_score < minimumScore) {
      warnings.push(
        `${label} image quality below threshold (${rec.quality_score}/${minimumScore})`
      );
    }
    if (rec.quality_band === "retake_recommended") {
      warnings.push(`${label} image flagged retake_recommended`);
    }
  }
  return warnings;
}

export function computeQualityMatchScore(
  before: VieComparisonCaptureRecord,
  after: VieComparisonCaptureRecord
): number {
  const avg = (before.quality_score + after.quality_score) / 2;
  const delta = Math.abs(before.quality_score - after.quality_score);
  const symmetryPenalty = Math.min(25, delta * 0.5);
  let score = avg - symmetryPenalty;
  if (before.framing !== after.framing) score -= 20;
  if (before.anatomical_region !== after.anatomical_region) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeConfidenceBand(
  pair: Pick<
    VieComparisonPair,
    "quality_match_score" | "framing_match_status" | "warnings" | "days_between"
  >
): VieComparisonConfidenceBand {
  let score = pair.quality_match_score;
  if (pair.framing_match_status === "mismatch") score -= 25;
  if (pair.warnings.length > 0) score -= 10 * pair.warnings.length;
  if (pair.days_between < 1) score -= 10;
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function deriveRecommendedUse(
  category: VieComparisonCategory,
  confidence: VieComparisonConfidenceBand,
  warnings: string[]
): VieComparisonRecommendedUse[] {
  const uses = new Set<VieComparisonRecommendedUse>();
  uses.add("clinical_review");

  if (category === "baseline_vs_follow_up" || category === "treatment_progression") {
    uses.add("patient_progress");
  }
  if (
    category === "donor_before_vs_after_extraction" ||
    category === "graft_tray_documentation" ||
    category === "pre_op_vs_post_op"
  ) {
    uses.add("audit_evidence");
  }
  if (confidence === "high" && warnings.length === 0 && category === "baseline_vs_follow_up") {
    uses.add("marketing_candidate");
  }
  if (category === "repair_review_progression" || category === "graft_tray_documentation") {
    uses.add("training_case");
  }
  return [...uses];
}

export function buildComparisonId(
  beforeImageId: string,
  afterImageId: string,
  category: VieComparisonCategory
): string {
  return `viecmp:${beforeImageId}:${afterImageId}:${category}`;
}

function sameCasePreference(a: VieComparisonCaptureRecord, b: VieComparisonCaptureRecord): boolean {
  if (!a.case_id || !b.case_id) return true;
  return a.case_id === b.case_id;
}

function canMatchFraming(
  before: VieComparisonCaptureRecord,
  after: VieComparisonCaptureRecord
): boolean {
  return before.framing === after.framing;
}

function canMatchRegionAndFamily(
  before: VieComparisonCaptureRecord,
  after: VieComparisonCaptureRecord
): boolean {
  return (
    before.anatomical_region === after.anatomical_region &&
    before.slot_family === after.slot_family &&
    canMatchFraming(before, after)
  );
}

function buildPair(
  before: VieComparisonCaptureRecord,
  after: VieComparisonCaptureRecord,
  category: VieComparisonCategory,
  minimumScore: number
): VieComparisonPair | null {
  if (before.patient_image_id === after.patient_image_id) return null;
  if (captureTimestampMs(before) >= captureTimestampMs(after)) return null;
  if (!sameCasePreference(before, after)) return null;

  const framingStatus = framingMatchStatus(before, after);
  const warnings = qualityWarnings(before, after, minimumScore);
  const qualityMatchScore = computeQualityMatchScore(before, after);

  const pair: VieComparisonPair = {
    comparison_id: buildComparisonId(before.patient_image_id, after.patient_image_id, category),
    patient_id: before.patient_id,
    case_id: before.case_id ?? after.case_id,
    before_image_id: before.patient_image_id,
    after_image_id: after.patient_image_id,
    comparison_category: category,
    anatomical_region: before.anatomical_region,
    slot_family: before.slot_family,
    before_timepoint: before.journey_stage,
    after_timepoint: after.journey_stage,
    days_between: daysBetween(before, after),
    quality_match_score: qualityMatchScore,
    angle_match_status: "pending_ai",
    framing_match_status: framingStatus,
    confidence_band: "medium",
    recommended_use: [],
    warnings,
  };
  pair.confidence_band = computeConfidenceBand(pair);
  pair.recommended_use = deriveRecommendedUse(category, pair.confidence_band, warnings);
  return pair;
}

function isAcceptedForComparison(record: VieComparisonCaptureRecord): boolean {
  return record.acceptance_status === "accepted";
}

function filterAccepted(records: VieComparisonCaptureRecord[]): VieComparisonCaptureRecord[] {
  return records.filter(isAcceptedForComparison);
}

function findBySlot(
  records: VieComparisonCaptureRecord[],
  slotSlug: string
): VieComparisonCaptureRecord[] {
  return records.filter((r) => r.protocol_slot_slug === slotSlug);
}

export function generateVieComparisonPairs(
  records: VieComparisonCaptureRecord[],
  minimumQualityScore: number = VIE_CAPTURE_POLICY_DEFAULTS.minimum_capture_quality_score
): VieComparisonPair[] {
  const accepted = filterAccepted(records);
  const pairs: VieComparisonPair[] = [];
  const seen = new Set<string>();

  const addPair = (pair: VieComparisonPair | null) => {
    if (!pair || seen.has(pair.comparison_id)) return;
    seen.add(pair.comparison_id);
    pairs.push(pair);
  };

  // baseline vs follow-up
  for (const before of accepted) {
    if (!BASELINE_STAGES.has(before.journey_stage)) continue;
    if (!isAdequateQuality(before, minimumQualityScore)) continue;
    for (const after of accepted) {
      if (!FOLLOW_UP_STAGES.has(after.journey_stage)) continue;
      if (!canMatchRegionAndFamily(before, after)) continue;
      addPair(buildPair(before, after, "baseline_vs_follow_up", minimumQualityScore));
    }
  }

  // pre-op vs post-op
  for (const before of accepted) {
    if (before.surgery_phase !== "pre_op" && before.protocol_template_slug !== "post_op_review")
      continue;
    if (before.protocol_template_slug === "post_op_review") continue;
    for (const after of accepted) {
      const postOp =
        after.journey_stage === "immediate_post_op" ||
        after.protocol_template_slug === "post_op_review" ||
        after.surgery_phase === "immediate_post_op";
      if (!postOp) continue;
      if (!canMatchRegionAndFamily(before, after)) continue;
      addPair(buildPair(before, after, "pre_op_vs_post_op", minimumQualityScore));
    }
  }

  // donor before vs after extraction
  const donorBefore = findBySlot(accepted, "donor_before_extraction");
  const donorFinal = findBySlot(accepted, "donor_final_extraction");
  for (const before of donorBefore) {
    for (const after of donorFinal) {
      if (!canMatchFraming(before, after)) continue;
      addPair(buildPair(before, after, "donor_before_vs_after_extraction", minimumQualityScore));
    }
  }

  // recipient before vs after implantation
  for (const before of accepted) {
    if (before.surgery_phase !== "pre_op") continue;
    if (before.slot_family === "donor" || before.slot_family === "graft_tray") continue;
    for (const after of accepted) {
      if (
        after.surgery_phase !== "immediate_post_op" &&
        after.journey_stage !== "immediate_post_op"
      )
        continue;
      if (!canMatchRegionAndFamily(before, after)) continue;
      addPair(
        buildPair(before, after, "recipient_before_vs_after_implantation", minimumQualityScore)
      );
    }
  }

  // graft tray documentation
  const trayOverview = findBySlot(accepted, "graft_tray_overview");
  const trayClose = findBySlot(accepted, "graft_tray_close");
  for (const before of trayOverview) {
    for (const after of trayClose) {
      addPair(buildPair(before, after, "graft_tray_documentation", minimumQualityScore));
    }
  }

  // repair review progression
  for (const before of accepted) {
    if (before.journey_stage !== "repair_review") continue;
    for (const after of accepted) {
      if (after.journey_stage !== "repair_review") continue;
      if (!canMatchRegionAndFamily(before, after)) continue;
      addPair(buildPair(before, after, "repair_review_progression", minimumQualityScore));
    }
  }

  // treatment progression (same family, different stages, not already covered)
  for (let i = 0; i < accepted.length; i++) {
    for (let j = i + 1; j < accepted.length; j++) {
      const a = accepted[i]!;
      const b = accepted[j]!;
      const [before, after] =
        compareJourneyStages(a.journey_stage, b.journey_stage) <= 0 ? [a, b] : [b, a];
      if (before.patient_image_id === after.patient_image_id) continue;
      if (!canMatchRegionAndFamily(before, after)) continue;
      if (before.journey_stage === after.journey_stage) continue;
      const pair = buildPair(before, after, "treatment_progression", minimumQualityScore);
      if (pair) addPair(pair);
    }
  }

  return pairs.sort((a, b) => b.quality_match_score - a.quality_match_score);
}

export function buildVieProgressionTimeline(
  records: VieComparisonCaptureRecord[],
  patientId: string
): VieProgressionTimeline {
  const accepted = filterAccepted(records);
  const byStage = new Map<VieJourneyStage, VieProgressionTimelineStage>();

  for (const stage of Object.keys(JOURNEY_STAGE_LABELS) as VieJourneyStage[]) {
    byStage.set(stage, { stage, label: JOURNEY_STAGE_LABELS[stage], groups: [] });
  }

  const groupKey = (r: VieComparisonCaptureRecord) =>
    `${r.anatomical_region}|${r.slot_family}|${r.framing}`;

  for (const stage of [...new Set(accepted.map((r) => r.journey_stage))]) {
    const stageRecords = accepted.filter((r) => r.journey_stage === stage);
    const groups = new Map<string, VieProgressionTimelineStage["groups"][number]>();

    for (const rec of stageRecords) {
      const key = groupKey(rec);
      let group = groups.get(key);
      if (!group) {
        group = {
          anatomical_region: rec.anatomical_region,
          slot_family: rec.slot_family,
          framing: rec.framing,
          images: [],
        };
        groups.set(key, group);
      }
      group.images.push({
        patient_image_id: rec.patient_image_id,
        journey_stage: rec.journey_stage,
        protocol_template_slug: rec.protocol_template_slug,
        protocol_slot_slug: rec.protocol_slot_slug,
        captured_at: rec.captured_at,
        quality_score: rec.quality_score,
      });
    }

    for (const group of groups.values()) {
      group.images.sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at));
    }

    const stageEntry = byStage.get(stage)!;
    stageEntry.groups = [...groups.values()].sort((a, b) =>
      a.anatomical_region.localeCompare(b.anatomical_region)
    );
  }

  const stages = [...byStage.values()]
    .filter((s) => s.groups.length > 0)
    .sort((a, b) => compareJourneyStages(a.stage, b.stage));

  return {
    engine_version: VIE_COMPARISON_ENGINE_VERSION,
    patient_id: patientId,
    stages,
  };
}

export function buildComparisonReadinessSummary(input: {
  pairs: VieComparisonPair[];
  timeline: VieProgressionTimeline;
  minimumQualityScore?: number;
}): VieComparisonReadinessSummary {
  const minimumQualityScore =
    input.minimumQualityScore ?? VIE_CAPTURE_POLICY_DEFAULTS.minimum_capture_quality_score;

  const suggested = input.pairs;
  const auditReady = suggested.filter(
    (p) =>
      p.confidence_band !== "low" &&
      p.recommended_use.includes("audit_evidence") &&
      p.warnings.length === 0
  );

  const baselineRegions = new Set<string>();
  const followUpRegions = new Set<string>();
  for (const stage of input.timeline.stages) {
    for (const group of stage.groups) {
      if (stage.stage === "baseline" || stage.stage === "consultation") {
        baselineRegions.add(group.anatomical_region);
      }
      if (FOLLOW_UP_STAGES.has(stage.stage)) {
        followUpRegions.add(group.anatomical_region);
      }
    }
  }

  let followUpCoverage = 0;
  if (baselineRegions.size > 0) {
    let matched = 0;
    for (const region of baselineRegions) {
      if (followUpRegions.has(region)) matched++;
    }
    followUpCoverage = Math.round((matched / baselineRegions.size) * 100);
  }

  const comparedRegions = new Set(suggested.map((p) => p.anatomical_region));
  const regionsWithoutComparison = [...baselineRegions].filter((r) => !comparedRegions.has(r));

  const nextRecommended = inferNextRecommendedCapture(input.timeline, minimumQualityScore);

  return {
    suggested_pairs_count: suggested.length,
    audit_ready_pairs_count: auditReady.length,
    follow_up_progression_coverage: followUpCoverage,
    regions_without_comparison: regionsWithoutComparison,
    next_recommended_capture: nextRecommended,
  };
}

function inferNextRecommendedCapture(
  timeline: VieProgressionTimeline,
  _minimumQualityScore: number
): VieComparisonReadinessSummary["next_recommended_capture"] {
  const hasBaseline = timeline.stages.some(
    (s) => s.stage === "baseline" || s.stage === "consultation"
  );
  const hasFollowUp = timeline.stages.some((s) => FOLLOW_UP_STAGES.has(s.stage));

  if (hasBaseline && !hasFollowUp) {
    return {
      protocol_slug: "follow_up_review",
      slot_slug: "fu_front",
      label: "Follow-up — front (match baseline framing)",
    };
  }

  const surgeryStage = timeline.stages.find((s) => s.stage === "surgery_day");
  if (surgeryStage) {
    const missingDonorFinal = !surgeryStage.groups.some((g) =>
      g.images.some((i) => i.protocol_slot_slug === "donor_final_extraction")
    );
    if (missingDonorFinal) {
      return {
        protocol_slug: "surgery_day",
        slot_slug: "donor_final_extraction",
        label: "Donor — final extraction",
      };
    }
  }

  if (!hasBaseline) {
    return {
      protocol_slug: "baseline_consultation",
      slot_slug: "front",
      label: "Baseline — front",
    };
  }

  return { protocol_slug: null, slot_slug: null, label: null };
}

export function deriveSurgeryComparisonStatus(
  pairs: VieComparisonPair[]
): VieSurgeryComparisonStatus {
  const hasCategory = (cat: VieComparisonCategory, partialOk = false) => {
    const matches = pairs.filter((p) => p.comparison_category === cat);
    if (matches.some((p) => p.confidence_band !== "low" && p.warnings.length === 0))
      return "ready" as const;
    if (partialOk && matches.length > 0) return "partial" as const;
    return "missing" as const;
  };

  return {
    donor_extraction_pair: hasCategory("donor_before_vs_after_extraction", true),
    graft_tray_pair: hasCategory("graft_tray_documentation", true),
    immediate_post_op_pair: hasCategory("pre_op_vs_post_op", true),
  };
}

export function isExcludedFromTimeline(record: VieComparisonCaptureRecord): boolean {
  return record.acceptance_status === "pending" || record.acceptance_status === "replaced";
}
