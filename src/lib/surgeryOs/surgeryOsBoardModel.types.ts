import type {
  SurgeryOsAlertKind,
  SurgeryOsAssignmentStatus,
  SurgeryOsLiveStatus,
  SurgeryOsNoteKind,
  SurgeryOsProcedureEventKind,
  SurgeryOsProcedurePhase,
  SurgeryOsReadinessChecklistKey,
  SurgeryOsReadinessRiskLevel,
  SurgeryOsSeverity,
  SurgeryOsTeamRole,
  SurgeryOsViewerRole,
  SurgeryOsWidgetKey,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import type { SurgeryOsVieCaptureSummary } from "@/src/lib/surgeryOs/surgeryOsVieCapture.types";
import type {
  GraftTrayAiProviderName,
  GraftTrayAiReviewAction,
  GraftTrayAiReviewStatus,
  GraftTrayConfidenceBand,
  GraftTrayImageQuality,
  GraftTrayMismatchBand,
} from "@/src/lib/imaging-os/graftTrayCountTypes";
import type {
  GraftTrayAiReviewAuditEntry,
  GraftTrayAiReviewDisplayState,
} from "@/src/lib/imaging-os/graftTrayReviewUxCore";
import type { GraftTrayFinalCountSource } from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import type { SurgeryCaseIntelligenceFacts } from "@/src/lib/outcomeIntelligence/surgeryCaseFactsCore";
import type {
  SurgeryOsGraftCountEventType,
  SurgeryOsGraftSessionPhase,
  SurgeryOsGraftTotals,
} from "@/src/lib/surgeryOs/surgeryOsGraftCounting";
import type { SurgeryOsGraftCountSessionLock } from "@/src/lib/surgeryOs/surgeryOsGraftSessionLocks";
import type { SurgeryOsGraftReconciliationStatus } from "@/src/lib/surgeryOs/surgeryOsGraftReconciliation";
import type {
  GraftIntelligenceSnapshot,
  GraftIntelligenceWarning,
} from "@/src/lib/surgeryOs/graftIntelligenceCore";
import type {
  LiveProcedureDelaySignal,
  LiveProcedureStageDuration,
  LiveProcedureTimelineItem,
  LiveProcedureTimelineSnapshot,
  LiveProcedureTimelineStage,
  LiveProcedureTimelineStatus,
} from "@/src/lib/surgeryOs/liveProcedureTimelineCore";
import type { ExtractionVelocitySnapshot } from "@/src/lib/surgeryOs/extractionVelocityCore";
import type { ImplantationSpeedSnapshot } from "@/src/lib/surgeryOs/implantationSpeedCore";
import type { SurgicalRiskDetectionSnapshot } from "@/src/lib/surgeryOs/surgicalRiskDetectionCore";
import type { TransectionMonitoringSnapshot } from "@/src/lib/surgeryOs/transectionMonitoringCore";
import type { SurgeonPerformanceSnapshot } from "@/src/lib/surgeryOs/surgeonPerformanceAnalyticsCore";
import type { SurgeryBenchmarkSnapshot } from "@/src/lib/surgeryOs/surgeryBenchmarkCore";
import type { SurgeonConsistencySnapshot } from "@/src/lib/surgeryOs/surgeonConsistencyCore";
import type { SurgeonRiskPatternSnapshot } from "@/src/lib/surgeryOs/surgeonRiskPatternCore";
import type { SurgeonPerformanceScoreSnapshot } from "@/src/lib/surgeryOs/surgeonPerformanceScoreCore";

export type {
  GraftIntelligenceSnapshot,
  GraftIntelligenceWarning,
  LiveProcedureDelaySignal,
  LiveProcedureStageDuration,
  LiveProcedureTimelineItem,
  LiveProcedureTimelineSnapshot,
  LiveProcedureTimelineStage,
  LiveProcedureTimelineStatus,
  ExtractionVelocitySnapshot,
  TransectionMonitoringSnapshot,
  ImplantationSpeedSnapshot,
  SurgicalRiskDetectionSnapshot,
  SurgeonPerformanceSnapshot,
  SurgeryBenchmarkSnapshot,
  SurgeonConsistencySnapshot,
  SurgeonRiskPatternSnapshot,
  SurgeonPerformanceScoreSnapshot,
};

export type SurgeryOsReadinessItem = {
  key: SurgeryOsReadinessChecklistKey;
  label: string;
  complete: boolean;
};

export type SurgeryOsLiveSurgery = {
  id: string;
  patientId: string | null;
  patientLabel: string;
  caseId: string | null;
  bookingId: string | null;
  surgeonLabel: string | null;
  assignedTeamSummary: string | null;
  targetGrafts: number | null;
  status: string;
  graftCountingEligible: boolean;
  procedurePhase: SurgeryOsProcedurePhase;
  procedurePhaseLabel: string;
  liveStatus: SurgeryOsLiveStatus;
  liveStatusLabel: string;
  scheduledStartAt: string | null;
  hrefs: {
    patient: string | null;
    case: string | null;
    surgery: string | null;
    calendar: string | null;
  };
};

export type SurgeryOsReadinessSnapshot = {
  surgeryId: string;
  patientLabel: string;
  readinessPercent: number;
  readinessRiskLevel: SurgeryOsReadinessRiskLevel;
  readinessRiskLabel: string;
  checklist: SurgeryOsReadinessItem[];
  hrefs: {
    patient: string | null;
    case: string | null;
    surgery: string | null;
  };
};

export type SurgeryOsProcedureTimelineEvent = {
  id: string;
  surgeryId: string;
  patientLabel: string;
  eventKind: SurgeryOsProcedureEventKind;
  eventLabel: string;
  occurredAt: string;
  recordedByLabel: string | null;
};

export type SurgeryOsTeamMember = {
  id: string;
  surgeryId: string;
  fiUserId: string;
  patientLabel: string;
  staffLabel: string;
  role: SurgeryOsTeamRole;
  roleLabel: string;
  assignmentStatus: SurgeryOsAssignmentStatus;
  assignmentStatusLabel: string;
};

export type SurgeryOsAlert = {
  id: string;
  kind: SurgeryOsAlertKind;
  title: string;
  detail: string;
  severity: SurgeryOsSeverity;
  surgeryId: string;
  href: string | null;
};

export type SurgeryOsOperationalNote = {
  id: string;
  surgeryId: string;
  patientLabel: string;
  noteKind: SurgeryOsNoteKind;
  noteKindLabel: string;
  severity: SurgeryOsSeverity;
  body: string;
  recordedAt: string;
  recordedByLabel: string | null;
};

export type SurgeryOsGraftCountEvent = {
  id: string;
  surgeryId: string;
  sessionId: string;
  eventType: SurgeryOsGraftCountEventType;
  eventTypeLabel: string;
  deltaExtracted: number;
  deltaImplanted: number;
  deltaDiscarded: number;
  singles: number | null;
  doubles: number | null;
  triples: number | null;
  multiples: number | null;
  totalHairs: number | null;
  note: string | null;
  createdAt: string;
  createdByLabel: string | null;
  reviewStatus: "pending" | "confirmed" | "rejected" | null;
  trayNumber: number | null;
};

export type SurgeryOsGraftTrayAiEstimateSummary = {
  estimateId: string;
  estimatedGraftCount: number | null;
  manualGraftCount: number | null;
  mismatchBand: GraftTrayMismatchBand;
  delta: number | null;
  confidence: number;
  confidenceBand: GraftTrayConfidenceBand;
  reviewStatus: GraftTrayAiReviewStatus;
  reviewerDecision: GraftTrayAiReviewAction | null;
  correctedCount: number | null;
  provider: GraftTrayAiProviderName;
  displayState: GraftTrayAiReviewDisplayState;
  displayLabel: string;
  requiresStaffReview: boolean;
  finalAcceptedCount: number | null;
  reviewWarnings: string[];
};

export type SurgeryOsGraftTrayIntelligenceSummary = {
  estimateId: string;
  imageId: string;
  graftTrayLinkId: string | null;
  hasFinalCount: boolean;
  finalAcceptedCount: number | null;
  originalAiEstimate: number | null;
  manualCount: number | null;
  varianceDelta: number | null;
  mismatchBand: GraftTrayMismatchBand;
  confidenceBand: GraftTrayConfidenceBand;
  imageQuality: GraftTrayImageQuality;
  reviewDecision: GraftTrayAiReviewAction | null;
  reviewStatus: GraftTrayAiReviewStatus;
  displayState: GraftTrayAiReviewDisplayState;
  reviewerId: string | null;
  reviewerLabel: string | null;
  reviewedAt: string | null;
  finalCountSource: GraftTrayFinalCountSource | null;
  isReadOnly: boolean;
  supersededStaleJob: boolean;
  sourceImageHref: string | null;
  reviewAuditTrail: GraftTrayAiReviewAuditEntry[];
  warnings: string[];
};

export type SurgeryOsGraftTrayCaseIntelligenceSummary = {
  reviewedTrayCount: number;
  pendingReviewCount: number;
  supersededStaleCount: number;
  totalFinalAcceptedGrafts: number | null;
  hasSupersededStaleEstimate: boolean;
};

export type SurgeryOsGraftTrayLinkSummary = {
  linkId: string;
  imageId: string;
  capturedAt: string;
  status: string;
  reviewRequired: boolean;
  imagingHref: string | null;
  aiEstimate: SurgeryOsGraftTrayAiEstimateSummary | null;
  intelligenceSummary: SurgeryOsGraftTrayIntelligenceSummary | null;
};

export type SurgeryOsGraftSummary = {
  surgeryId: string;
  patientLabel: string;
  sessionId: string | null;
  phase: SurgeryOsGraftSessionPhase;
  phaseLabel: string;
  targetGrafts: number | null;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  totalHairs: number;
  averageHairsPerGraft: number | null;
  progressPercent: number | null;
  reconciliationStatus: SurgeryOsGraftReconciliationStatus;
  reconciliationStatusLabel: string;
  pendingTrayCount: number;
  confirmedTrayGrafts: number;
  trayImageCount: number;
  trayImageLinks: SurgeryOsGraftTrayLinkSummary[];
  graftTrayIntelligence: SurgeryOsGraftTrayCaseIntelligenceSummary | null;
  caseIntelligenceFacts: SurgeryCaseIntelligenceFacts | null;
  reconciledAt: string | null;
  reconciledByLabel: string | null;
  sessionLocks: {
    extraction: SurgeryOsGraftCountSessionLock;
    implantation: SurgeryOsGraftCountSessionLock;
  };
  totals: SurgeryOsGraftTotals;
  hrefs: {
    patient: string | null;
    case: string | null;
    surgery: string | null;
  };
};

export type SurgeryOsCommandCentrePayload = {
  tenantId: string;
  tenantName: string;
  loadedAt: string;
  operationalDay: {
    calendarTimezone: string;
    todayYmd: string;
    localStartIso: string;
    localEndIso: string;
  };
  viewer: {
    role: SurgeryOsViewerRole;
    staffRole: string | null;
    visibleWidgets: readonly SurgeryOsWidgetKey[];
  };
  liveSurgeries: SurgeryOsLiveSurgery[];
  readinessSnapshots: SurgeryOsReadinessSnapshot[];
  procedureTimeline: SurgeryOsProcedureTimelineEvent[];
  teamAssignments: SurgeryOsTeamMember[];
  alerts: SurgeryOsAlert[];
  operationalNotes: SurgeryOsOperationalNote[];
  graftSummary: SurgeryOsGraftSummary[];
  graftEvents: SurgeryOsGraftCountEvent[];
  vieCapture: SurgeryOsVieCaptureSummary[];
  liveTimeline: LiveProcedureTimelineSnapshot[];
  graftIntelligence: GraftIntelligenceSnapshot[];
  extractionVelocity: ExtractionVelocitySnapshot[];
  transectionMonitoring: TransectionMonitoringSnapshot[];
  implantationSpeed: ImplantationSpeedSnapshot[];
  surgicalRisks: SurgicalRiskDetectionSnapshot[];
  surgeonPerformance: SurgeonPerformanceSnapshot[];
  surgeryBenchmarks: SurgeryBenchmarkSnapshot[];
  surgeonConsistency: SurgeonConsistencySnapshot[];
  surgeonRiskPatterns: SurgeonRiskPatternSnapshot[];
  surgeonPerformanceScores: SurgeonPerformanceScoreSnapshot[];
  intelligence: {
    policy: {
      canExportCompetencyData: boolean;
      canExportAuditData: boolean;
      canBuildProfessionalGraph: boolean;
      canSendToFiOs: boolean;
      requiresConsent: boolean;
      exportMode: "disabled" | "dev_only" | "allowed";
    };
    hints: Array<{
      signalKind: string;
      title: string;
      summary: string;
      relatedWidget: string;
      confidence: number;
      exportEligible: boolean;
    }>;
    generatedAt: string;
  };
};
