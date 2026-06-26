import {
  nextRecommendedSlotSlug,
  parseProgressMeta,
  protocolRequiredCompletionPercent,
  slotIsSatisfied,
  type ProtocolSlotDef,
} from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  computeDonorDocumentationCompleteness,
  computeSurgicalDocumentationCompleteness,
} from "@/src/lib/vie/vieCompleteness";
import { getVieProtocol, groupSurgeryDaySlotsByPhase } from "@/src/lib/vie/vieProtocolCatalog";
import type { VieProtocolSlotDef, VieSurgeryPhase } from "@/src/lib/vie/vieProtocolTypes";

import type {
  SurgeryOsVieCaptureSummary,
  SurgeryOsVieCaptureWarning,
  SurgeryOsVieEvidenceSlotStatus,
  SurgeryOsViePhaseCaptureStatus,
} from "./surgeryOsVieCapture.types";
import type { VieComparisonPair } from "@/src/lib/vie/vieComparisonTypes";
import type { VieAlignmentResultRow } from "@/src/lib/vie/vieAlignmentTypes";
import type { VieOutcomeSummary } from "@/src/lib/vie/vieOutcomeTypes";
import { pickSurgeryOutcomeDomains } from "@/src/lib/vie/vieOutcomeIntelligenceCore";
import { deriveSurgeryComparisonStatus } from "@/src/lib/vie/vieLongitudinalComparisonCore";

const GRAFT_TRAY_SLOTS = ["graft_tray_overview", "graft_tray_close"] as const;
const IMMEDIATE_POST_OP_REQUIRED_SLOTS = ["immediate_post_op_front", "immediate_post_op_close"] as const;

function toProtocolSlotDef(slot: VieProtocolSlotDef): ProtocolSlotDef {
  return {
    slug: slot.slug,
    label: slot.label,
    required: slot.required,
    suggested_region: slot.suggested_region,
    instruction: slot.instruction,
  };
}

function slotAccepted(slug: string, progress: Record<string, unknown>): boolean {
  return slotIsSatisfied({ slug, label: slug, required: true }, progress);
}

function slotPending(slug: string, progress: Record<string, unknown>): boolean {
  return Boolean(parseProgressMeta(progress).vie_pending?.[slug]);
}

function latestQualityForSlot(slug: string, progress: Record<string, unknown>): number | null {
  const meta = parseProgressMeta(progress);
  const pending = meta.vie_pending?.[slug];
  if (pending?.quality_score != null) return pending.quality_score;
  const accepted = meta.vie_slot_quality?.[slug];
  if (accepted?.quality_score != null) return accepted.quality_score;
  return null;
}

function nextSlotInPhase(
  phaseSlots: VieProtocolSlotDef[],
  progress: Record<string, unknown>
): { slug: string | null; label: string | null } {
  const defs = phaseSlots.map(toProtocolSlotDef);
  for (const slot of phaseSlots) {
    if (slot.required === false) continue;
    const def = toProtocolSlotDef(slot);
    if (!slotIsSatisfied(def, progress) && !slotPending(slot.slug, progress)) {
      return { slug: slot.slug, label: slot.label };
    }
  }
  const globalNext = nextRecommendedSlotSlug(defs, progress);
  if (globalNext && phaseSlots.some((s) => s.slug === globalNext)) {
    const match = phaseSlots.find((s) => s.slug === globalNext);
    return { slug: globalNext, label: match?.label ?? globalNext };
  }
  return { slug: null, label: null };
}

function evidenceGroupStatus(
  slotSlugs: readonly string[],
  progress: Record<string, unknown>
): SurgeryOsVieEvidenceSlotStatus {
  const accepted = slotSlugs.filter((s) => slotAccepted(s, progress)).length;
  const pending = slotSlugs.filter((s) => slotPending(s, progress)).length;
  if (pending > 0) return "pending_review";
  if (accepted >= slotSlugs.length) return "complete";
  if (accepted > 0) return "partial";
  return "missing";
}

export function buildSurgeryOsViePhaseStatuses(progress: Record<string, unknown>): SurgeryOsViePhaseCaptureStatus[] {
  const protocol = getVieProtocol("surgery_day");
  if (!protocol) return [];

  return groupSurgeryDaySlotsByPhase(protocol.slots).map(({ phase, label, slots }) => {
    const requiredSlots = slots.filter((s) => s.required !== false);
    const acceptedCount = requiredSlots.filter((s) => slotAccepted(s.slug, progress)).length;
    const pendingReviewCount = requiredSlots.filter((s) => slotPending(s.slug, progress)).length;
    const qualityScores = requiredSlots
      .map((s) => latestQualityForSlot(s.slug, progress))
      .filter((n): n is number => n != null);
    const latestQualityScore = qualityScores.length ? Math.max(...qualityScores) : null;
    const next = nextSlotInPhase(slots, progress);

    return {
      phase,
      label,
      requiredTotal: requiredSlots.length,
      acceptedCount,
      pendingReviewCount,
      latestQualityScore,
      nextRecommendedSlot: next.slug,
      nextRecommendedSlotLabel: next.label,
    };
  });
}

const DONOR_ALIGNMENT_SLOTS = ["donor_before_extraction", "donor_final_extraction"] as const;
const IMMEDIATE_POST_OP_FRONT_SLOTS = ["immediate_post_op_front", "postop_front"] as const;

function alignmentBySlotFromResults(
  alignmentResults: VieAlignmentResultRow[],
  slotSlug: string
): VieAlignmentResultRow | null {
  return (
    alignmentResults.find((r) => {
      const metaSlot = r.metadata.protocol_slot_slug;
      return typeof metaSlot === "string" && metaSlot === slotSlug;
    }) ?? null
  );
}

export function deriveSurgeryAlignmentWarnings(
  progress: Record<string, unknown>,
  alignmentResults: VieAlignmentResultRow[] = []
): SurgeryOsVieCaptureWarning[] {
  const warnings: SurgeryOsVieCaptureWarning[] = [];
  const poorStatuses = new Set(["poor", "retake_recommended"]);

  for (const slotSlug of DONOR_ALIGNMENT_SLOTS) {
    if (!slotAccepted(slotSlug, progress)) continue;
    const alignment = alignmentBySlotFromResults(alignmentResults, slotSlug);
    if (alignment && poorStatuses.has(alignment.alignment_status)) {
      warnings.push({
        kind: "donor_alignment_inconsistent",
        label: `Donor documentation alignment inconsistent (${slotSlug.replace(/_/g, " ")} — ${alignment.alignment_score}%)`,
        severity: "warning",
        slotSlug,
      });
    }
  }

  for (const slotSlug of IMMEDIATE_POST_OP_FRONT_SLOTS) {
    if (!slotAccepted(slotSlug, progress)) continue;
    const alignment = alignmentBySlotFromResults(alignmentResults, slotSlug);
    if (alignment && poorStatuses.has(alignment.alignment_status)) {
      warnings.push({
        kind: "immediate_post_op_alignment_inconsistent",
        label: `Immediate post-op front alignment inconsistent (${alignment.alignment_score}%)`,
        severity: "warning",
        slotSlug,
      });
    }
  }

  return warnings;
}

export function deriveSurgeryOsVieWarnings(
  progress: Record<string, unknown>,
  alignmentResults: VieAlignmentResultRow[] = []
): SurgeryOsVieCaptureWarning[] {
  const warnings: SurgeryOsVieCaptureWarning[] = [];
  const meta = parseProgressMeta(progress);

  const warnIfMissing = (slotSlug: string, kind: SurgeryOsVieCaptureWarning["kind"], label: string) => {
    if (!slotAccepted(slotSlug, progress) && !slotPending(slotSlug, progress)) {
      warnings.push({ kind, label, severity: "warning", slotSlug });
    }
  };

  warnIfMissing(
    "donor_final_extraction",
    "missing_donor_final_extraction",
    "Missing donor final extraction image"
  );
  warnIfMissing("graft_tray_overview", "missing_graft_tray_overview", "Missing graft tray overview");
  warnIfMissing("graft_tray_close", "missing_graft_tray_close", "Missing graft tray close-up");

  const missingPostOp = IMMEDIATE_POST_OP_REQUIRED_SLOTS.filter(
    (s) => !slotAccepted(s, progress) && !slotPending(s, progress)
  );
  if (missingPostOp.length > 0) {
    warnings.push({
      kind: "missing_immediate_post_op",
      label: "Missing immediate post-op images",
      severity: "warning",
    });
  }

  for (const [slotSlug, pending] of Object.entries(meta.vie_pending ?? {})) {
    const lowQuality =
      pending.quality_band === "retake_recommended" ||
      pending.clinically_usable === false ||
      (typeof pending.quality_score === "number" && pending.quality_score < 65);
    if (lowQuality) {
      warnings.push({
        kind: "pending_low_quality",
        label: `Pending low-quality capture (${slotSlug.replace(/_/g, " ")})`,
        severity: "critical",
        slotSlug,
      });
    }
  }

  warnings.push(...deriveSurgeryAlignmentWarnings(progress, alignmentResults));

  return warnings;
}

function mapSurgeryOutcomeReadiness(outcome: VieOutcomeSummary | null | undefined): SurgeryOsVieCaptureSummary["outcomeReadiness"] {
  if (!outcome) return null;
  const picked = pickSurgeryOutcomeDomains(outcome.domains);
  return {
    overall_score: outcome.overall_outcome_readiness_score,
    confidence_band: outcome.confidence_band,
    audit_ready: outcome.audit_ready,
    clinical_review_recommended: outcome.clinical_review_recommended,
    surgical_healing: {
      score: picked.surgical_healing?.score ?? 0,
      status: picked.surgical_healing?.status ?? "insufficient_evidence",
      evidence_count: picked.surgical_healing?.evidence_count ?? 0,
    },
    donor_recovery: {
      score: picked.donor_recovery?.score ?? 0,
      status: picked.donor_recovery?.status ?? "insufficient_evidence",
      evidence_count: picked.donor_recovery?.evidence_count ?? 0,
    },
    documentation_readiness: {
      score: picked.documentation_readiness?.score ?? 0,
      status: picked.documentation_readiness?.status ?? "insufficient_evidence",
    },
  };
}

export function buildSurgeryOsVieCaptureSummary(input: {
  surgeryId: string;
  patientId: string;
  patientLabel: string;
  caseId: string | null;
  bookingId: string | null;
  procedureDayId: string | null;
  sessionId: string | null;
  progress: Record<string, unknown>;
  comparisonPairs?: VieComparisonPair[];
  alignmentResults?: VieAlignmentResultRow[];
  outcomeSummary?: VieOutcomeSummary | null;
}): SurgeryOsVieCaptureSummary {
  const sessions = [{ template_slug: "surgery_day", progress: input.progress }];
  const surgical = computeSurgicalDocumentationCompleteness(sessions);
  const donor = computeDonorDocumentationCompleteness(sessions);
  const protocol = getVieProtocol("surgery_day");
  const protocolSlots = protocol?.slots.map(toProtocolSlotDef) ?? [];
  const globalNextSlug = protocolSlots.length ? nextRecommendedSlotSlug(protocolSlots, input.progress) : null;
  const globalNextLabel =
    globalNextSlug != null ? protocol?.slots.find((s) => s.slug === globalNextSlug)?.label ?? globalNextSlug : null;

  return {
    surgeryId: input.surgeryId,
    patientId: input.patientId,
    patientLabel: input.patientLabel,
    caseId: input.caseId,
    bookingId: input.bookingId,
    procedureDayId: input.procedureDayId,
    sessionId: input.sessionId,
    protocolSlug: "surgery_day",
    surgicalDocumentationPercent: surgical.percent,
    donorDocumentationPercent: donor.percent,
    graftTrayStatus: evidenceGroupStatus(GRAFT_TRAY_SLOTS, input.progress),
    immediatePostOpStatus: evidenceGroupStatus(IMMEDIATE_POST_OP_REQUIRED_SLOTS, input.progress),
    phases: buildSurgeryOsViePhaseStatuses(input.progress),
    warnings: deriveSurgeryOsVieWarnings(input.progress, input.alignmentResults ?? []),
    nextRecommendedSlot: globalNextSlug,
    nextRecommendedSlotLabel: globalNextLabel,
    comparisonStatus: deriveSurgeryComparisonStatus(input.comparisonPairs ?? []),
    outcomeReadiness: mapSurgeryOutcomeReadiness(input.outcomeSummary),
  };
}

export function surgeryPhaseForSlot(slotSlug: string): VieSurgeryPhase | null {
  const protocol = getVieProtocol("surgery_day");
  const slot = protocol?.slots.find((s) => s.slug === slotSlug);
  return slot?.surgery_phase ?? null;
}

export function buildVieSurgeryImageMetadata(input: {
  caseId: string | null;
  bookingId: string | null;
  procedureDayId: string | null;
  slotSlug: string;
  protocolSlug?: string;
}): Record<string, unknown> {
  return {
    vie_surgery_context: {
      case_id: input.caseId,
      booking_id: input.bookingId,
      procedure_day_id: input.procedureDayId,
      surgery_phase: surgeryPhaseForSlot(input.slotSlug),
      protocol_slug: input.protocolSlug ?? "surgery_day",
      slot_slug: input.slotSlug,
      capture_surface: "surgery_os",
    },
  };
}

export function isVieCaptureSource(source: string): boolean {
  return source === "vie_capture_wizard" || source === "surgery_os";
}

export { protocolRequiredCompletionPercent, slotIsSatisfied, slotPending, slotAccepted };
