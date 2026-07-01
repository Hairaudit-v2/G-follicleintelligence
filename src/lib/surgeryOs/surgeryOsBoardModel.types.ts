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
  SurgeryOsGraftCountEventType,
  SurgeryOsGraftCountSessionLock,
  SurgeryOsGraftReconciliationStatus,
  SurgeryOsGraftSessionPhase,
  SurgeryOsGraftTotals,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
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

export type {
  GraftIntelligenceSnapshot,
  GraftIntelligenceWarning,
  LiveProcedureDelaySignal,
  LiveProcedureStageDuration,
  LiveProcedureTimelineItem,
  LiveProcedureTimelineSnapshot,
  LiveProcedureTimelineStage,
  LiveProcedureTimelineStatus,
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
