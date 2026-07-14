import type { GraftTrayFinalCountSource } from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import type {
  HairAuditOutcomeReportAction,
  HairAuditOutcomeReportStatus,
} from "./hairAuditOutcomeReportWorkflowCore";
import type { LongitudinalOutcomeSummaryFacts } from "./longitudinalOutcomeComparisonCore";
import type { SurgeryImagingIntelligenceSummaryFacts } from "./surgeryImagingIntelligenceSummaryCore";

export const SURGERY_INTELLIGENCE_GRAFT_COUNT_SOURCE_FILTERS = [
  "all",
  "ai",
  "manual",
  "override",
] as const;

export type SurgeryIntelligenceGraftCountSourceFilter =
  (typeof SURGERY_INTELLIGENCE_GRAFT_COUNT_SOURCE_FILTERS)[number];

export type SurgeryIntelligenceDashboardFilters = {
  occurredAfter?: string | null;
  occurredBefore?: string | null;
  procedureDateAfter?: string | null;
  procedureDateBefore?: string | null;
  clinicId?: string | null;
  surgeonFiUserId?: string | null;
  teamFiUserId?: string | null;
  graftCountSource?: SurgeryIntelligenceGraftCountSourceFilter;
};

export type SurgeryIntelligencePublishedCaseRow = {
  eventId: string;
  occurredAt: string;
  lastPublishedAt: string;
  clinicId: string | null;
  caseId: string | null;
  surgeryId: string;
  patientId: string | null;
  procedureDate: string | null;
  finalReviewedGraftCount: number | null;
  hasFinalGraftCount: boolean;
  graftCountSource: GraftTrayFinalCountSource | null;
  mismatchBand: string | null;
  confidenceBand: string | null;
  imageQuality: string | null;
  reviewerId: string | null;
  reviewerLabel: string | null;
  graftTrayReviewPending: boolean;
  supersededStaleEstimate: boolean;
  surgeonFiUserId: string | null;
  teamFiUserIds: string[];
  graftTrayAiEstimate: number | null;
  graftTrayManualCount: number | null;
  imagingIntelligenceSummary: SurgeryImagingIntelligenceSummaryFacts | null;
  longitudinalOutcomeSummary: LongitudinalOutcomeSummaryFacts | null;
  beforeAfterReady: boolean;
  donorRecoveryReady: boolean;
  recipientGrowthReady: boolean;
  followUpWindowStatus: LongitudinalOutcomeSummaryFacts["follow_up_windows"];
  missingOutcomeEvidence: string[];
};

export type SurgeryIntelligenceSourceSplit = {
  ai: number;
  manual: number;
  override: number;
  unknown: number;
};

export type SurgeryIntelligenceDashboardMetrics = {
  totalPublishedCases: number;
  totalReviewedCasesWithFinalCount: number;
  totalFinalReviewedGraftCount: number;
  averageFinalGraftCountPerCase: number | null;
  sourceSplit: SurgeryIntelligenceSourceSplit;
  averageAiManualVariance: number | null;
  mismatchBandDistribution: Record<string, number>;
  confidenceBandDistribution: Record<string, number>;
  imageQualityDistribution: Record<string, number>;
  casesNeedingReview: number;
  casesMissingFinalCount: number;
  casesAuditReady: number;
  casesBeforeAfterReady: number;
  averageImagingCompletenessScore: number | null;
  casesWithImagingGaps: number;
  imagingAuditReadinessDistribution: Record<string, number>;
  casesDueForFollowUp: number;
  casesReadyForBeforeAfterComparison: number;
  casesMissingDonorFollowUp: number;
  casesMissingRecipientFollowUp: number;
  casesReadyForHairAuditOutcomeReport: number;
};

export type SurgeryIntelligenceDashboardTableRow = {
  eventId: string;
  procedureDate: string | null;
  caseId: string | null;
  surgeryId: string;
  patientId: string | null;
  patientReference: string;
  finalReviewedGraftCount: number | null;
  hasFinalGraftCount: boolean;
  graftCountSource: GraftTrayFinalCountSource | null;
  mismatchBand: string | null;
  confidenceBand: string | null;
  imageQuality: string | null;
  reviewerLabel: string | null;
  graftTrayReviewPending: boolean;
  surgeryHref: string;
  imagingHref: string | null;
  caseHref: string | null;
  hairAuditLinkLabel: string;
  hairAuditAdminHref: string | null;
  hairAuditReportHref: string | null;
  hairAuditLinkageConflict: boolean;
  imagingCompletenessScore: number;
  imagingCompletenessLabel: string;
  imagingAuditReadinessLabel: string;
  imagingAuditReady: boolean;
  imagingBeforeAfterReady: boolean;
  imagingMissingRequirementsCount: number;
  poorQualityImageCount: number;
  longitudinalComparisonLabel: string;
  followUpDue: boolean;
  beforeAfterComparisonReady: boolean;
  donorFollowUpMissing: boolean;
  recipientFollowUpMissing: boolean;
  hairAuditOutcomeReportReady: boolean;
  outcomeReportStatus: HairAuditOutcomeReportStatus;
  outcomeReportStatusLabel: string;
  outcomeReportLink: string | null;
  outcomeReportRecommendedAction: HairAuditOutcomeReportAction;
  outcomeReportAvailableActions: HairAuditOutcomeReportAction[];
  outcomeReportMissingEvidence: string[];
};

export type SurgeryIntelligenceDashboardFilterOptions = {
  surgeons: Array<{ id: string; label: string }>;
  teamMembers: Array<{ id: string; label: string }>;
  clinics: Array<{ id: string; label: string }>;
};

export type SurgeryIntelligenceDashboardPayload = {
  tenantId: string;
  filters: SurgeryIntelligenceDashboardFilters;
  filterOptions: SurgeryIntelligenceDashboardFilterOptions;
  metrics: SurgeryIntelligenceDashboardMetrics;
  tableRows: SurgeryIntelligenceDashboardTableRow[];
  eventCountLoaded: number;
  dedupedCaseCount: number;
};
