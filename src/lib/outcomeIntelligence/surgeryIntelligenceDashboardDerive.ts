/**
 * FI-OUTCOME-INTELLIGENCE-SURGERY-DASHBOARD-1 — pure aggregates from published surgery-case facts events.
 */

import type { FiAnalyticsEventRow } from "@/src/lib/analytics-os/analyticsEventCore";
import type { GraftTrayFinalCountSource } from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import type { SurgeryCaseIntelligenceFacts } from "./surgeryCaseFactsCore";
import {
  SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE,
  SURGERY_CASE_INTELLIGENCE_SOURCE,
} from "./surgeryCaseFactsPublisherCore";
import {
  formatHairAuditLinkDashboardLabel,
  resolveHairAuditLinkForSurgery,
} from "./hairAuditLinkCore";
import {
  formatHairAuditOutcomeReportActionLabel,
  formatHairAuditOutcomeReportStatusLabel,
  resolveHairAuditOutcomeReportWorkflow,
} from "./hairAuditOutcomeReportWorkflowCore";
import {
  formatLongitudinalComparisonReadinessLabel,
  isCaseDueForFollowUp,
  type LongitudinalOutcomeSummaryFacts,
} from "./longitudinalOutcomeComparisonCore";
import {
  formatSurgeryImagingAuditReadinessLabel,
  formatSurgeryImagingCompletenessLabel,
  type SurgeryImagingIntelligenceSummaryFacts,
} from "./surgeryImagingIntelligenceSummaryCore";
import type {
  SurgeryIntelligenceDashboardFilters,
  SurgeryIntelligenceDashboardMetrics,
  SurgeryIntelligenceDashboardTableRow,
  SurgeryIntelligenceGraftCountSourceFilter,
  SurgeryIntelligencePublishedCaseRow,
  SurgeryIntelligenceSourceSplit,
} from "./surgeryIntelligenceDashboardTypes";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isGraftCountSource(value: unknown): value is GraftTrayFinalCountSource {
  return value === "ai" || value === "manual" || value === "override";
}

function readPayloadJson(metadata: Record<string, unknown>): SurgeryCaseIntelligenceFacts | null {
  const payload = metadata.payload_json;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as SurgeryCaseIntelligenceFacts;
}

function readImagingSummary(
  facts: SurgeryCaseIntelligenceFacts
): SurgeryImagingIntelligenceSummaryFacts | null {
  const summary = facts.imaging_intelligence_summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  return summary;
}

function readLongitudinalSummary(
  facts: SurgeryCaseIntelligenceFacts
): LongitudinalOutcomeSummaryFacts | null {
  const summary = facts.longitudinal_outcome_summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  return summary;
}

export function parsePublishedSurgeryCaseIntelligenceEvent(
  row: FiAnalyticsEventRow,
  expectedTenantId: string
): SurgeryIntelligencePublishedCaseRow | null {
  const tid = expectedTenantId.trim();
  if (row.tenant_id !== tid) return null;
  if (row.module_name !== "surgery_os") return null;
  if (row.event_type !== SURGERY_CASE_INTELLIGENCE_FACTS_EVENT_TYPE) return null;

  const metadata = row.event_metadata ?? {};
  if (readString(metadata.source) !== SURGERY_CASE_INTELLIGENCE_SOURCE) return null;

  const facts = readPayloadJson(metadata);
  if (!facts) return null;
  if (facts.tenant_id !== tid) return null;

  return {
    eventId: row.id,
    occurredAt: row.occurred_at,
    lastPublishedAt: readString(metadata.last_published_at) ?? row.occurred_at,
    clinicId: row.clinic_id,
    caseId: facts.case_id,
    surgeryId: facts.surgery_id,
    patientId: facts.patient_id,
    procedureDate: facts.procedure_date,
    finalReviewedGraftCount: facts.has_final_graft_count ? facts.final_reviewed_graft_count : null,
    hasFinalGraftCount: facts.has_final_graft_count,
    graftCountSource: isGraftCountSource(facts.graft_count_source)
      ? facts.graft_count_source
      : null,
    mismatchBand: facts.mismatch_band,
    confidenceBand: facts.confidence_band,
    imageQuality: facts.image_quality,
    reviewerId: facts.reviewer_id,
    reviewerLabel: facts.reviewer_label,
    graftTrayReviewPending: facts.graft_tray_review_pending,
    supersededStaleEstimate: facts.superseded_stale_estimate,
    surgeonFiUserId: facts.surgeon_fi_user_id,
    teamFiUserIds: [...new Set((facts.team_fi_user_ids ?? []).filter(Boolean))],
    graftTrayAiEstimate: facts.graft_tray_ai_estimate,
    graftTrayManualCount: facts.graft_tray_manual_count,
    imagingIntelligenceSummary: readImagingSummary(facts),
    longitudinalOutcomeSummary: readLongitudinalSummary(facts),
    beforeAfterReady: facts.before_after_ready ?? false,
    donorRecoveryReady: facts.donor_recovery_ready ?? false,
    recipientGrowthReady: facts.recipient_growth_ready ?? false,
    followUpWindowStatus: facts.follow_up_window_status ?? [],
    missingOutcomeEvidence: facts.missing_outcome_evidence ?? [],
  };
}

export function dedupeLatestPublishedCaseRows(
  rows: readonly SurgeryIntelligencePublishedCaseRow[]
): SurgeryIntelligencePublishedCaseRow[] {
  const byKey = new Map<string, SurgeryIntelligencePublishedCaseRow>();
  for (const row of rows) {
    const key = row.caseId?.trim() || row.surgeryId;
    const existing = byKey.get(key);
    if (!existing || row.occurredAt > existing.occurredAt) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

function matchesGraftCountSourceFilter(
  row: SurgeryIntelligencePublishedCaseRow,
  filter: SurgeryIntelligenceGraftCountSourceFilter | undefined
): boolean {
  if (!filter || filter === "all") return true;
  return row.graftCountSource === filter;
}

export function filterPublishedCaseRows(
  rows: readonly SurgeryIntelligencePublishedCaseRow[],
  filters: SurgeryIntelligenceDashboardFilters
): SurgeryIntelligencePublishedCaseRow[] {
  return rows.filter((row) => {
    if (filters.clinicId?.trim() && row.clinicId !== filters.clinicId.trim()) return false;
    if (filters.surgeonFiUserId?.trim() && row.surgeonFiUserId !== filters.surgeonFiUserId.trim()) {
      return false;
    }
    if (filters.teamFiUserId?.trim() && !row.teamFiUserIds.includes(filters.teamFiUserId.trim())) {
      return false;
    }
    if (!matchesGraftCountSourceFilter(row, filters.graftCountSource)) return false;

    if (filters.procedureDateAfter?.trim()) {
      const pd = row.procedureDate?.trim();
      if (!pd || pd < filters.procedureDateAfter.trim()) return false;
    }
    if (filters.procedureDateBefore?.trim()) {
      const pd = row.procedureDate?.trim();
      if (!pd || pd > filters.procedureDateBefore.trim()) return false;
    }

    return true;
  });
}

function incrementDistribution(
  bucket: Record<string, number>,
  value: string | null | undefined,
  unknownLabel = "unknown"
): void {
  const key = value?.trim() || unknownLabel;
  bucket[key] = (bucket[key] ?? 0) + 1;
}

export function buildSurgeryIntelligenceDashboardMetrics(
  rows: readonly SurgeryIntelligencePublishedCaseRow[]
): SurgeryIntelligenceDashboardMetrics {
  const withFinal = rows.filter((r) => r.hasFinalGraftCount && r.finalReviewedGraftCount != null);
  const totalFinal = withFinal.reduce((sum, r) => sum + (r.finalReviewedGraftCount ?? 0), 0);

  const sourceSplit: SurgeryIntelligenceSourceSplit = {
    ai: 0,
    manual: 0,
    override: 0,
    unknown: 0,
  };
  for (const row of withFinal) {
    const src = row.graftCountSource;
    if (src === "ai") sourceSplit.ai += 1;
    else if (src === "manual") sourceSplit.manual += 1;
    else if (src === "override") sourceSplit.override += 1;
    else sourceSplit.unknown += 1;
  }

  const varianceSamples: number[] = [];
  for (const row of withFinal) {
    if (row.graftTrayAiEstimate != null && row.graftTrayManualCount != null) {
      varianceSamples.push(Math.abs(row.graftTrayAiEstimate - row.graftTrayManualCount));
    }
  }

  const mismatchBandDistribution: Record<string, number> = {};
  const confidenceBandDistribution: Record<string, number> = {};
  const imageQualityDistribution: Record<string, number> = {};
  const imagingAuditReadinessDistribution: Record<string, number> = {};
  const imagingScores: number[] = [];
  let casesAuditReady = 0;
  let casesBeforeAfterReady = 0;
  let casesWithImagingGaps = 0;
  let casesDueForFollowUp = 0;
  let casesReadyForBeforeAfterComparison = 0;
  let casesMissingDonorFollowUp = 0;
  let casesMissingRecipientFollowUp = 0;
  let casesReadyForHairAuditOutcomeReport = 0;

  for (const row of rows) {
    incrementDistribution(mismatchBandDistribution, row.mismatchBand);
    incrementDistribution(confidenceBandDistribution, row.confidenceBand);
    incrementDistribution(imageQualityDistribution, row.imageQuality);

    const imaging = row.imagingIntelligenceSummary;
    if (imaging) {
      imagingScores.push(imaging.completeness_score);
      if (imaging.completeness_score < 100) casesWithImagingGaps += 1;
      if (imaging.audit_readiness.overall_audit_ready) casesAuditReady += 1;
      if (imaging.audit_readiness.before_after_ready) casesBeforeAfterReady += 1;
      incrementDistribution(
        imagingAuditReadinessDistribution,
        formatSurgeryImagingAuditReadinessLabel(imaging.audit_readiness)
      );
    } else {
      incrementDistribution(imagingAuditReadinessDistribution, "Not started");
    }

    const longitudinal = row.longitudinalOutcomeSummary;
    if (longitudinal) {
      if (isCaseDueForFollowUp(longitudinal)) casesDueForFollowUp += 1;
      if (longitudinal.comparison_readiness.ready_for_comparison) {
        casesReadyForBeforeAfterComparison += 1;
      }
      if (longitudinal.missing_outcome_evidence.includes("donor_follow_up")) {
        casesMissingDonorFollowUp += 1;
      }
      if (longitudinal.missing_outcome_evidence.includes("recipient_follow_up")) {
        casesMissingRecipientFollowUp += 1;
      }
      if (longitudinal.hairaudit_report_ready) casesReadyForHairAuditOutcomeReport += 1;
    } else if (
      row.beforeAfterReady ||
      row.imagingIntelligenceSummary?.audit_readiness.before_after_ready
    ) {
      casesReadyForBeforeAfterComparison += 1;
    }
  }

  return {
    totalPublishedCases: rows.length,
    totalReviewedCasesWithFinalCount: withFinal.length,
    totalFinalReviewedGraftCount: totalFinal,
    averageFinalGraftCountPerCase:
      withFinal.length > 0 ? Math.round((totalFinal / withFinal.length) * 10) / 10 : null,
    sourceSplit,
    averageAiManualVariance:
      varianceSamples.length > 0
        ? Math.round((varianceSamples.reduce((a, b) => a + b, 0) / varianceSamples.length) * 10) /
          10
        : null,
    mismatchBandDistribution,
    confidenceBandDistribution,
    imageQualityDistribution,
    casesNeedingReview: rows.filter((r) => r.graftTrayReviewPending || !r.hasFinalGraftCount)
      .length,
    casesMissingFinalCount: rows.filter((r) => !r.hasFinalGraftCount).length,
    casesAuditReady,
    casesBeforeAfterReady,
    averageImagingCompletenessScore:
      imagingScores.length > 0
        ? Math.round(
            (imagingScores.reduce((sum, score) => sum + score, 0) / imagingScores.length) * 10
          ) / 10
        : null,
    casesWithImagingGaps,
    imagingAuditReadinessDistribution,
    casesDueForFollowUp,
    casesReadyForBeforeAfterComparison,
    casesMissingDonorFollowUp,
    casesMissingRecipientFollowUp,
    casesReadyForHairAuditOutcomeReport,
  };
}

export function formatSurgeryIntelligencePatientReference(patientId: string | null): string {
  if (!patientId) return "—";
  return `Patient ${patientId.slice(0, 8)}`;
}

export function buildSurgeryIntelligenceDashboardTableRows(input: {
  tenantId: string;
  rows: readonly SurgeryIntelligencePublishedCaseRow[];
  caseMetadataByCaseId?: Readonly<Record<string, Record<string, unknown>>>;
  fiReportIdByCaseId?: Readonly<Record<string, string>>;
  fiReportStatusByCaseId?: Readonly<Record<string, string>>;
  globalHairAuditSourceByCaseId?: Readonly<
    Record<string, readonly { source_system: string; source_case_id: string }[]>
  >;
}): SurgeryIntelligenceDashboardTableRow[] {
  const base = `/fi-admin/${input.tenantId.trim()}`;
  return [...input.rows]
    .sort((a, b) => {
      const ad = a.procedureDate ?? "";
      const bd = b.procedureDate ?? "";
      if (ad !== bd) return bd.localeCompare(ad);
      return b.occurredAt.localeCompare(a.occurredAt);
    })
    .map((row) => {
      const caseMetadata =
        row.caseId && input.caseMetadataByCaseId
          ? (input.caseMetadataByCaseId[row.caseId] ?? null)
          : null;
      const hairAuditLink = resolveHairAuditLinkForSurgery({
        tenantId: input.tenantId,
        surgeryId: row.surgeryId,
        caseId: row.caseId,
        patientId: row.patientId,
        caseMetadata,
        fiReportId:
          row.caseId && input.fiReportIdByCaseId
            ? (input.fiReportIdByCaseId[row.caseId] ?? null)
            : null,
        globalCaseSourceIds:
          row.caseId && input.globalHairAuditSourceByCaseId
            ? (input.globalHairAuditSourceByCaseId[row.caseId] ?? [])
            : [],
      });

      const imaging = row.imagingIntelligenceSummary;
      const longitudinal = row.longitudinalOutcomeSummary;
      const imagingCompletenessScore = imaging?.completeness_score ?? 0;
      const imagingAuditReadiness = imaging?.audit_readiness ?? {
        overall_audit_ready: false,
        before_after_ready: false,
        hairaudit_linkage_conflict: hairAuditLink.linkage_conflict,
      };

      return {
        eventId: row.eventId,
        procedureDate: row.procedureDate,
        caseId: row.caseId,
        surgeryId: row.surgeryId,
        patientId: row.patientId,
        patientReference: formatSurgeryIntelligencePatientReference(row.patientId),
        finalReviewedGraftCount: row.finalReviewedGraftCount,
        hasFinalGraftCount: row.hasFinalGraftCount,
        graftCountSource: row.graftCountSource,
        mismatchBand: row.mismatchBand,
        confidenceBand: row.confidenceBand,
        imageQuality: row.imageQuality,
        reviewerLabel: row.reviewerLabel,
        graftTrayReviewPending: row.graftTrayReviewPending,
        surgeryHref: `${base}/surgery-os`,
        imagingHref: row.patientId ? `${base}/patients/${row.patientId}/imaging` : null,
        caseHref: row.caseId ? `${base}/cases/${row.caseId}` : null,
        hairAuditLinkLabel: formatHairAuditLinkDashboardLabel(hairAuditLink),
        hairAuditAdminHref: hairAuditLink.hrefs.hairaudit_admin_href,
        hairAuditReportHref: hairAuditLink.hrefs.audit_report_href,
        hairAuditLinkageConflict: hairAuditLink.linkage_conflict,
        imagingCompletenessScore,
        imagingCompletenessLabel: formatSurgeryImagingCompletenessLabel(imagingCompletenessScore),
        imagingAuditReadinessLabel: formatSurgeryImagingAuditReadinessLabel(
          imaging?.audit_readiness ?? {
            overall_audit_ready: false,
            before_after_ready: false,
            hairaudit_linkage_conflict: hairAuditLink.linkage_conflict,
          }
        ),
        imagingAuditReady: imagingAuditReadiness.overall_audit_ready,
        imagingBeforeAfterReady: imagingAuditReadiness.before_after_ready,
        imagingMissingRequirementsCount: imaging?.audit_readiness.missing_requirements.length ?? 0,
        poorQualityImageCount: imaging?.poor_quality_image_ids.length ?? 0,
        longitudinalComparisonLabel: formatLongitudinalComparisonReadinessLabel(
          longitudinal?.comparison_readiness ?? {
            ready_for_comparison: false,
            outcome_measured: false,
          }
        ),
        followUpDue: longitudinal ? isCaseDueForFollowUp(longitudinal) : false,
        beforeAfterComparisonReady:
          longitudinal?.before_after_ready ??
          row.beforeAfterReady ??
          imagingAuditReadiness.before_after_ready,
        donorFollowUpMissing:
          longitudinal?.missing_outcome_evidence.includes("donor_follow_up") ?? false,
        recipientFollowUpMissing:
          longitudinal?.missing_outcome_evidence.includes("recipient_follow_up") ?? false,
        hairAuditOutcomeReportReady: longitudinal?.hairaudit_report_ready ?? false,
        ...(() => {
          const workflow = resolveHairAuditOutcomeReportWorkflow({
            tenantId: input.tenantId,
            facts: {
              longitudinal_outcome_summary: longitudinal,
              missing_outcome_evidence: row.missingOutcomeEvidence,
              before_after_ready: row.beforeAfterReady,
              donor_recovery_ready: row.donorRecoveryReady,
              recipient_growth_ready: row.recipientGrowthReady,
            },
            hairAuditLink,
            reportContext: row.caseId
              ? {
                  fiReportId:
                    (row.caseId && input.fiReportIdByCaseId
                      ? input.fiReportIdByCaseId[row.caseId]
                      : null) ?? hairAuditLink.fi_report_id,
                  reportStatus:
                    row.caseId && input.fiReportStatusByCaseId
                      ? input.fiReportStatusByCaseId[row.caseId]
                      : null,
                }
              : null,
          });
          return {
            outcomeReportStatus: workflow.report_status,
            outcomeReportStatusLabel: formatHairAuditOutcomeReportStatusLabel(
              workflow.report_status
            ),
            outcomeReportLink: workflow.report_link,
            outcomeReportRecommendedAction: workflow.recommended_action,
            outcomeReportAvailableActions: workflow.available_actions,
            outcomeReportMissingEvidence: workflow.missing_evidence,
          };
        })(),
      };
    });
}

export { formatHairAuditOutcomeReportActionLabel };

export function buildSurgeryIntelligenceFilterOptions(
  rows: readonly SurgeryIntelligencePublishedCaseRow[]
): {
  surgeons: Array<{ id: string; label: string }>;
  teamMembers: Array<{ id: string; label: string }>;
  clinics: Array<{ id: string; label: string }>;
} {
  const surgeons = new Map<string, string>();
  const teamMembers = new Map<string, string>();
  const clinics = new Map<string, string>();

  for (const row of rows) {
    if (row.surgeonFiUserId) {
      surgeons.set(row.surgeonFiUserId, row.surgeonFiUserId);
    }
    for (const memberId of row.teamFiUserIds) {
      teamMembers.set(memberId, memberId);
    }
    if (row.clinicId) {
      clinics.set(row.clinicId, row.clinicId);
    }
  }

  const toSorted = (map: Map<string, string>) =>
    [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

  return {
    surgeons: toSorted(surgeons),
    teamMembers: toSorted(teamMembers),
    clinics: toSorted(clinics),
  };
}

export function parseSurgeryIntelligenceDashboardFilters(
  searchParams: Record<string, string | string[] | undefined>
): SurgeryIntelligenceDashboardFilters {
  const read = (key: string): string | null => {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  };

  const source = read("source");
  const graftCountSource =
    source === "ai" || source === "manual" || source === "override" ? source : "all";

  const from = read("from");
  const to = read("to");

  return {
    occurredAfter: from ? `${from}T00:00:00.000Z` : null,
    occurredBefore: to ? `${to}T23:59:59.999Z` : null,
    procedureDateAfter: read("procedure_from"),
    procedureDateBefore: read("procedure_to"),
    clinicId: read("clinic"),
    surgeonFiUserId: read("surgeon"),
    teamFiUserId: read("team"),
    graftCountSource,
  };
}

export function composeSurgeryIntelligenceDashboardFromEvents(input: {
  tenantId: string;
  events: readonly FiAnalyticsEventRow[];
  filters: SurgeryIntelligenceDashboardFilters;
  caseMetadataByCaseId?: Readonly<Record<string, Record<string, unknown>>>;
  fiReportIdByCaseId?: Readonly<Record<string, string>>;
  fiReportStatusByCaseId?: Readonly<Record<string, string>>;
  globalHairAuditSourceByCaseId?: Readonly<
    Record<string, readonly { source_system: string; source_case_id: string }[]>
  >;
}): {
  metrics: SurgeryIntelligenceDashboardMetrics;
  tableRows: SurgeryIntelligenceDashboardTableRow[];
  filterOptions: ReturnType<typeof buildSurgeryIntelligenceFilterOptions>;
  eventCountLoaded: number;
  dedupedCaseCount: number;
} {
  const parsed = input.events
    .map((event) => parsePublishedSurgeryCaseIntelligenceEvent(event, input.tenantId))
    .filter((row): row is SurgeryIntelligencePublishedCaseRow => row != null);

  const deduped = dedupeLatestPublishedCaseRows(parsed);
  const filterOptions = buildSurgeryIntelligenceFilterOptions(deduped);
  const filtered = filterPublishedCaseRows(deduped, input.filters);

  return {
    metrics: buildSurgeryIntelligenceDashboardMetrics(filtered),
    tableRows: buildSurgeryIntelligenceDashboardTableRows({
      tenantId: input.tenantId,
      rows: filtered,
      caseMetadataByCaseId: input.caseMetadataByCaseId,
      fiReportIdByCaseId: input.fiReportIdByCaseId,
      fiReportStatusByCaseId: input.fiReportStatusByCaseId,
      globalHairAuditSourceByCaseId: input.globalHairAuditSourceByCaseId,
    }),
    filterOptions,
    eventCountLoaded: input.events.length,
    dedupedCaseCount: deduped.length,
  };
}
