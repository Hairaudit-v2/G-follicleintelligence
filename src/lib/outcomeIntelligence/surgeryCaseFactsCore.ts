/**
 * FI-OUTCOME-INTELLIGENCE-SURGERY-CASE-FACTS-1 — surgery-case Outcome Intelligence fact layer.
 * Pure read-model mapper combining reviewed graft-tray intelligence with SurgeryOS graft data.
 */

import type {
  GraftTrayFinalCountSource,
  GraftTrayIntelligenceSummary,
} from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import {
  mapGraftTrayIntelligenceToOutcomeFacts,
  type GraftTrayOutcomeIntelligenceFact,
} from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import type {
  GraftTrayAiReviewAction,
  GraftTrayAiReviewStatus,
  GraftTrayConfidenceBand,
  GraftTrayImageQuality,
  GraftTrayMismatchBand,
} from "@/src/lib/imaging-os/graftTrayCountTypes";
import type { GraftTrayAiReviewDisplayState } from "@/src/lib/imaging-os/graftTrayReviewUxCore";
import type { FiOutcomeConfidenceLevel } from "@/src/lib/fi-os/outcomeIntelligenceSignals";
import { deriveOutcomeConfidenceLevel } from "@/src/lib/fi-os/outcomeIntelligenceSignals";

export const SURGERY_CASE_INTELLIGENCE_FACTS_VERSION =
  "surgery_case_intelligence_facts_v1" as const;

export type SurgeryCaseGraftTrayLinkFacts = {
  link_id: string;
  image_id: string;
  estimate_id: string | null;
  final_accepted_count: number | null;
  ai_estimate: number | null;
  manual_count: number | null;
  graft_count_source: GraftTrayFinalCountSource | null;
  mismatch_band: string | null;
  confidence_band: string | null;
  image_quality: string | null;
  reviewer_id: string | null;
  reviewer_label: string | null;
  reviewed_at: string | null;
  superseded_stale_job: boolean;
  has_final_count: boolean;
};

export type SurgeryCaseIntelligenceFacts = {
  facts_version: typeof SURGERY_CASE_INTELLIGENCE_FACTS_VERSION;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  surgery_id: string;
  booking_id: string | null;
  procedure_date: string | null;
  final_reviewed_graft_count: number | null;
  graft_tray_ai_estimate: number | null;
  graft_tray_manual_count: number | null;
  graft_count_source: GraftTrayFinalCountSource | null;
  mismatch_band: string | null;
  confidence_band: string | null;
  image_quality: string | null;
  reviewer_id: string | null;
  reviewer_label: string | null;
  reviewed_at: string | null;
  has_final_graft_count: boolean;
  graft_tray_review_pending: boolean;
  superseded_stale_estimate: boolean;
  graft_session_id: string | null;
  target_grafts: number | null;
  extracted_grafts: number;
  implanted_grafts: number;
  discarded_grafts: number;
  remaining_grafts: number;
  reconciliation_status: string;
  graft_session_phase: string;
  reconciled_at: string | null;
  confirmed_tray_grafts: number;
  surgery_status: string | null;
  procedure_phase: string | null;
  live_status: string | null;
  surgeon_fi_user_id: string | null;
  team_fi_user_ids: string[];
  graft_tray_image_ids: string[];
  graft_tray_link_ids: string[];
  graft_tray_links: SurgeryCaseGraftTrayLinkFacts[];
  graft_tray_outcome_facts: GraftTrayOutcomeIntelligenceFact[];
  confidence_level: FiOutcomeConfidenceLevel;
};

export type SurgeryCaseFactsTrayLinkInput = {
  linkId: string;
  imageId: string;
  intelligenceSummary: {
    estimateId: string;
    graftTrayLinkId: string | null;
    hasFinalCount: boolean;
    finalAcceptedCount: number | null;
    originalAiEstimate: number | null;
    manualCount: number | null;
    mismatchBand: string;
    confidenceBand: string;
    imageQuality: string;
    reviewerId: string | null;
    reviewerLabel: string | null;
    reviewedAt: string | null;
    finalCountSource: GraftTrayFinalCountSource | null;
    supersededStaleJob: boolean;
    reviewStatus: string;
  } | null;
};

export type SurgeryCaseFactsGraftTrayRollupInput = {
  reviewedTrayCount: number;
  pendingReviewCount: number;
  supersededStaleCount: number;
  totalFinalAcceptedGrafts: number | null;
  hasSupersededStaleEstimate: boolean;
} | null;

export type SurgeryCaseFactsInput = {
  tenantId: string;
  patientId: string | null;
  caseId: string | null;
  surgeryId: string;
  bookingId: string | null;
  procedureDate: string | null;
  surgeonFiUserId: string | null;
  teamFiUserIds?: string[];
  surgeryStatus?: string | null;
  procedurePhase?: string | null;
  liveStatus?: string | null;
  graftSessionId: string | null;
  targetGrafts: number | null;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  reconciliationStatus: string;
  graftSessionPhase: string;
  reconciledAt: string | null;
  confirmedTrayGrafts: number;
  trayImageLinks: SurgeryCaseFactsTrayLinkInput[];
  graftTrayIntelligence: SurgeryCaseFactsGraftTrayRollupInput;
};

function mapLinkFacts(link: SurgeryCaseFactsTrayLinkInput): SurgeryCaseGraftTrayLinkFacts {
  const summary = link.intelligenceSummary;
  return {
    link_id: link.linkId,
    image_id: link.imageId,
    estimate_id: summary?.estimateId ?? null,
    final_accepted_count: summary?.hasFinalCount ? summary.finalAcceptedCount : null,
    ai_estimate: summary?.supersededStaleJob ? null : summary?.originalAiEstimate ?? null,
    manual_count: summary?.manualCount ?? null,
    graft_count_source: summary?.hasFinalCount ? summary.finalCountSource : null,
    mismatch_band: summary?.mismatchBand ?? null,
    confidence_band: summary?.confidenceBand ?? null,
    image_quality: summary?.imageQuality ?? null,
    reviewer_id: summary?.reviewerId ?? null,
    reviewer_label: summary?.reviewerLabel ?? null,
    reviewed_at: summary?.reviewedAt ?? null,
    superseded_stale_job: summary?.supersededStaleJob ?? false,
    has_final_count: summary?.hasFinalCount ?? false,
  };
}

function selectPrimaryReviewedLink(
  links: SurgeryCaseFactsTrayLinkInput[]
): SurgeryCaseFactsTrayLinkInput["intelligenceSummary"] {
  for (const link of links) {
    const summary = link.intelligenceSummary;
    if (summary?.hasFinalCount && !summary.supersededStaleJob) return summary;
  }
  return null;
}

function resolveCaseGraftCountSource(
  links: SurgeryCaseFactsTrayLinkInput[]
): GraftTrayFinalCountSource | null {
  const sources = new Set<GraftTrayFinalCountSource>();
  for (const link of links) {
    const summary = link.intelligenceSummary;
    if (summary?.hasFinalCount && summary.finalCountSource) {
      sources.add(summary.finalCountSource);
    }
  }
  if (sources.size === 0) return null;
  if (sources.size === 1) return [...sources][0] ?? null;
  return null;
}

function toGraftTrayIntelligenceSummary(
  link: SurgeryCaseFactsTrayLinkInput
): GraftTrayIntelligenceSummary | null {
  const summary = link.intelligenceSummary;
  if (!summary) return null;
  return {
    estimateId: summary.estimateId,
    imageId: link.imageId,
    graftTrayLinkId: summary.graftTrayLinkId,
    hasFinalCount: summary.hasFinalCount,
    finalAcceptedCount: summary.finalAcceptedCount,
    originalAiEstimate: summary.originalAiEstimate,
    manualCount: summary.manualCount,
    varianceDelta: null,
    mismatchBand: summary.mismatchBand as GraftTrayMismatchBand,
    confidenceBand: summary.confidenceBand as GraftTrayConfidenceBand,
    imageQuality: summary.imageQuality as GraftTrayImageQuality,
    reviewDecision: null as GraftTrayAiReviewAction | null,
    reviewStatus: summary.reviewStatus as GraftTrayAiReviewStatus,
    displayState: "accepted_ai" as GraftTrayAiReviewDisplayState,
    reviewerId: summary.reviewerId,
    reviewerLabel: summary.reviewerLabel,
    reviewedAt: summary.reviewedAt,
    finalCountSource: summary.finalCountSource,
    isReadOnly: summary.hasFinalCount,
    supersededStaleJob: summary.supersededStaleJob,
    sourceImageHref: null,
    reviewAuditTrail: [],
    warnings: [],
  };
}

export function shouldExposeSurgeryCaseIntelligenceFacts(input: {
  trayImageLinkCount: number;
  hasGraftSession: boolean;
  reviewedTrayCount: number;
  surgeryStatus: string | null;
  reconciliationStatus: string;
}): boolean {
  if (input.trayImageLinkCount > 0 || input.hasGraftSession) return true;
  if (input.reviewedTrayCount > 0) return true;
  const completed =
    input.surgeryStatus === "completed" ||
    input.surgeryStatus === "done" ||
    input.surgeryStatus === "closed";
  const reconciled =
    input.reconciliationStatus === "balanced" || input.reconciliationStatus === "completed";
  return completed || reconciled;
}

export function mapSurgeryCaseIntelligenceFacts(
  input: SurgeryCaseFactsInput
): SurgeryCaseIntelligenceFacts | null {
  const rollup = input.graftTrayIntelligence;
  const linkFacts = input.trayImageLinks.map(mapLinkFacts);
  const reviewedLinks = input.trayImageLinks.filter(
    (l) => l.intelligenceSummary?.hasFinalCount && !l.intelligenceSummary.supersededStaleJob
  );
  const primary = selectPrimaryReviewedLink(input.trayImageLinks);
  const graftTrayOutcomeFacts = input.trayImageLinks
    .map((link) => {
      const intelligence = toGraftTrayIntelligenceSummary(link);
      return intelligence ? mapGraftTrayIntelligenceToOutcomeFacts(intelligence) : null;
    })
    .filter((fact): fact is GraftTrayOutcomeIntelligenceFact => fact != null);

  const hasFinalGraftCount =
    (rollup?.totalFinalAcceptedGrafts != null && reviewedLinks.length > 0) ||
    (reviewedLinks.length === 1 && reviewedLinks[0]?.intelligenceSummary?.hasFinalCount === true);

  const eligible = shouldExposeSurgeryCaseIntelligenceFacts({
    trayImageLinkCount: input.trayImageLinks.length,
    hasGraftSession: input.graftSessionId != null,
    reviewedTrayCount: rollup?.reviewedTrayCount ?? 0,
    surgeryStatus: input.surgeryStatus ?? null,
    reconciliationStatus: input.reconciliationStatus,
  });
  if (!eligible) return null;

  const metricValues = {
    final_reviewed_graft_count: hasFinalGraftCount ? rollup?.totalFinalAcceptedGrafts ?? primary?.finalAcceptedCount ?? null : null,
    extracted_grafts: input.extractedGrafts,
    implanted_grafts: input.implantedGrafts,
    target_grafts: input.targetGrafts,
    graft_tray_reviewed_count: rollup?.reviewedTrayCount ?? 0,
  };

  return {
    facts_version: SURGERY_CASE_INTELLIGENCE_FACTS_VERSION,
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    case_id: input.caseId,
    surgery_id: input.surgeryId,
    booking_id: input.bookingId,
    procedure_date: input.procedureDate,
    final_reviewed_graft_count: hasFinalGraftCount
      ? rollup?.totalFinalAcceptedGrafts ?? primary?.finalAcceptedCount ?? null
      : null,
    graft_tray_ai_estimate: primary?.originalAiEstimate ?? null,
    graft_tray_manual_count: primary?.manualCount ?? null,
    graft_count_source: resolveCaseGraftCountSource(input.trayImageLinks),
    mismatch_band: primary?.mismatchBand ?? null,
    confidence_band: primary?.confidenceBand ?? null,
    image_quality: primary?.imageQuality ?? null,
    reviewer_id: primary?.reviewerId ?? null,
    reviewer_label: primary?.reviewerLabel ?? null,
    reviewed_at: primary?.reviewedAt ?? null,
    has_final_graft_count: hasFinalGraftCount,
    graft_tray_review_pending: (rollup?.pendingReviewCount ?? 0) > 0,
    superseded_stale_estimate: rollup?.hasSupersededStaleEstimate ?? false,
    graft_session_id: input.graftSessionId,
    target_grafts: input.targetGrafts,
    extracted_grafts: input.extractedGrafts,
    implanted_grafts: input.implantedGrafts,
    discarded_grafts: input.discardedGrafts,
    remaining_grafts: input.remainingGrafts,
    reconciliation_status: input.reconciliationStatus,
    graft_session_phase: input.graftSessionPhase,
    reconciled_at: input.reconciledAt,
    confirmed_tray_grafts: input.confirmedTrayGrafts,
    surgery_status: input.surgeryStatus ?? null,
    procedure_phase: input.procedurePhase ?? null,
    live_status: input.liveStatus ?? null,
    surgeon_fi_user_id: input.surgeonFiUserId,
    team_fi_user_ids: [...new Set((input.teamFiUserIds ?? []).filter(Boolean))],
    graft_tray_image_ids: input.trayImageLinks.map((l) => l.imageId),
    graft_tray_link_ids: input.trayImageLinks.map((l) => l.linkId),
    graft_tray_links: linkFacts,
    graft_tray_outcome_facts: graftTrayOutcomeFacts,
    confidence_level: deriveOutcomeConfidenceLevel({
      sourceTable: "fi_surgery_graft_sessions",
      sourceId: input.graftSessionId,
      metricValues,
    }),
  };
}