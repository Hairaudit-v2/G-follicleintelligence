/**
 * Client-safe SurgeryOS payload schema — shared by API route, refresh hook, and tests.
 */
import { z } from "zod";

import {
  SURGERY_OS_ASSIGNMENT_STATUSES,
  SURGERY_OS_LIVE_STATUSES,
  SURGERY_OS_NOTE_KINDS,
  SURGERY_OS_PROCEDURE_EVENT_KINDS,
  SURGERY_OS_PROCEDURE_PHASES,
  SURGERY_OS_READINESS_CHECKLIST_KEYS,
  SURGERY_OS_READINESS_RISK_LEVELS,
  SURGERY_OS_SEVERITIES,
  SURGERY_OS_TEAM_ROLES,
  SURGERY_OS_VIEWER_ROLES,
  SURGERY_OS_WIDGET_KEYS,
  SURGERY_OS_ALERT_KINDS,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  SURGERY_OS_GRAFT_COUNT_EVENT_TYPES,
  SURGERY_OS_GRAFT_RECONCILIATION_STATUSES,
  SURGERY_OS_GRAFT_SESSION_PHASES,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import { LIVE_PROCEDURE_TIMELINE_STAGES } from "@/src/lib/surgeryOs/liveProcedureTimelineCore";
import { VIE_SURGERY_PHASE_GROUPS } from "@/src/lib/vie/vieProtocolTypes";
import type { SurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";

export type {
  SurgeryOsAlert,
  SurgeryOsCommandCentrePayload,
  GraftIntelligenceSnapshot,
  LiveProcedureTimelineSnapshot,
  ExtractionVelocitySnapshot,
  TransectionMonitoringSnapshot,
  ImplantationSpeedSnapshot,
  SurgicalRiskDetectionSnapshot,
  SurgeryOsGraftSummary,
  SurgeryOsLiveSurgery,
  SurgeryOsOperationalNote,
  SurgeryOsProcedureTimelineEvent,
  SurgeryOsReadinessSnapshot,
  SurgeryOsTeamMember,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";

export { SURGERY_OS_SEVERITIES } from "@/src/lib/surgeryOs/surgeryOsBoardModel";

const operationalDaySchema = z.object({
  calendarTimezone: z.string(),
  todayYmd: z.string(),
  localStartIso: z.string(),
  localEndIso: z.string(),
});

const recordHrefsSchema = z.object({
  patient: z.string().nullable(),
  case: z.string().nullable(),
  surgery: z.string().nullable(),
  calendar: z.string().nullable(),
});

const liveSurgerySchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid().nullable(),
  patientLabel: z.string(),
  caseId: z.string().uuid().nullable(),
  bookingId: z.string().uuid().nullable(),
  surgeonLabel: z.string().nullable(),
  assignedTeamSummary: z.string().nullable(),
  targetGrafts: z.number().int().nullable(),
  status: z.string(),
  graftCountingEligible: z.boolean(),
  procedurePhase: z.enum(SURGERY_OS_PROCEDURE_PHASES),
  procedurePhaseLabel: z.string(),
  liveStatus: z.enum(SURGERY_OS_LIVE_STATUSES),
  liveStatusLabel: z.string(),
  scheduledStartAt: z.string().nullable(),
  hrefs: recordHrefsSchema,
});

const readinessItemSchema = z.object({
  key: z.enum(SURGERY_OS_READINESS_CHECKLIST_KEYS),
  label: z.string(),
  complete: z.boolean(),
});

const readinessSnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  readinessPercent: z.number().int().min(0).max(100),
  readinessRiskLevel: z.enum(SURGERY_OS_READINESS_RISK_LEVELS),
  readinessRiskLabel: z.string(),
  checklist: z.array(readinessItemSchema),
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    surgery: z.string().nullable(),
  }),
});

const timelineEventSchema = z.object({
  id: z.string().uuid(),
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  eventKind: z.enum(SURGERY_OS_PROCEDURE_EVENT_KINDS),
  eventLabel: z.string(),
  occurredAt: z.string(),
  recordedByLabel: z.string().nullable(),
});

const teamMemberSchema = z.object({
  id: z.string().uuid(),
  surgeryId: z.string().uuid(),
  fiUserId: z.string().uuid(),
  patientLabel: z.string(),
  staffLabel: z.string(),
  role: z.enum(SURGERY_OS_TEAM_ROLES),
  roleLabel: z.string(),
  assignmentStatus: z.enum(SURGERY_OS_ASSIGNMENT_STATUSES),
  assignmentStatusLabel: z.string(),
});

const alertSchema = z.object({
  id: z.string(),
  kind: z.enum(SURGERY_OS_ALERT_KINDS),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(SURGERY_OS_SEVERITIES),
  surgeryId: z.string().uuid(),
  href: z.string().nullable(),
});

const graftCompositionSchema = z.object({
  singles: z.number().int().min(0),
  doubles: z.number().int().min(0),
  triples: z.number().int().min(0),
  multiples: z.number().int().min(0),
});

const graftTotalsSchema = z.object({
  targetGrafts: z.number().int().nullable(),
  extractedGrafts: z.number().int().min(0),
  implantedGrafts: z.number().int().min(0),
  discardedGrafts: z.number().int().min(0),
  remainingGrafts: z.number().int(),
  totalHairs: z.number().int().min(0),
  averageHairsPerGraft: z.number().nullable(),
  composition: graftCompositionSchema,
});

const graftCountEventSchema = z.object({
  id: z.string().uuid(),
  surgeryId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventType: z.enum(SURGERY_OS_GRAFT_COUNT_EVENT_TYPES),
  eventTypeLabel: z.string(),
  deltaExtracted: z.number().int(),
  deltaImplanted: z.number().int(),
  deltaDiscarded: z.number().int(),
  singles: z.number().int().min(0).nullable(),
  doubles: z.number().int().min(0).nullable(),
  triples: z.number().int().min(0).nullable(),
  multiples: z.number().int().min(0).nullable(),
  totalHairs: z.number().int().min(0).nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  createdByLabel: z.string().nullable(),
  reviewStatus: z.enum(["pending", "confirmed", "rejected"]).nullable(),
  trayNumber: z.number().int().positive().nullable(),
});

const graftSessionLockSchema = z.object({
  kind: z.enum(["extraction", "implantation"]),
  deviceId: z.string().nullable(),
  heldAt: z.string().nullable(),
  heldByFiUserId: z.string().uuid().nullable(),
  heldByLabel: z.string().nullable(),
  isHeldByDevice: z.boolean(),
  isStale: z.boolean(),
});

const graftSummarySchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  sessionId: z.string().uuid().nullable(),
  phase: z.enum(SURGERY_OS_GRAFT_SESSION_PHASES),
  phaseLabel: z.string(),
  targetGrafts: z.number().int().nullable(),
  extractedGrafts: z.number().int().min(0),
  implantedGrafts: z.number().int().min(0),
  discardedGrafts: z.number().int().min(0),
  remainingGrafts: z.number().int(),
  singles: z.number().int().min(0),
  doubles: z.number().int().min(0),
  triples: z.number().int().min(0),
  multiples: z.number().int().min(0),
  totalHairs: z.number().int().min(0),
  averageHairsPerGraft: z.number().nullable(),
  progressPercent: z.number().int().min(0).max(100).nullable(),
  reconciliationStatus: z.enum(SURGERY_OS_GRAFT_RECONCILIATION_STATUSES),
  reconciliationStatusLabel: z.string(),
  pendingTrayCount: z.number().int().min(0),
  confirmedTrayGrafts: z.number().int().min(0),
  reconciledAt: z.string().nullable(),
  reconciledByLabel: z.string().nullable(),
  sessionLocks: z.object({
    extraction: graftSessionLockSchema,
    implantation: graftSessionLockSchema,
  }),
  totals: graftTotalsSchema,
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    surgery: z.string().nullable(),
  }),
});

const operationalNoteSchema = z.object({
  id: z.string().uuid(),
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  noteKind: z.enum(SURGERY_OS_NOTE_KINDS),
  noteKindLabel: z.string(),
  severity: z.enum(SURGERY_OS_SEVERITIES),
  body: z.string(),
  recordedAt: z.string(),
  recordedByLabel: z.string().nullable(),
});

const vieSurgeryPhaseSchema = z.enum(
  VIE_SURGERY_PHASE_GROUPS.map((g) => g.phase) as [
    (typeof VIE_SURGERY_PHASE_GROUPS)[number]["phase"],
    ...(typeof VIE_SURGERY_PHASE_GROUPS)[number]["phase"][],
  ]
);

const vieCapturePhaseSchema = z.object({
  phase: vieSurgeryPhaseSchema,
  label: z.string(),
  requiredTotal: z.number().int().min(0),
  acceptedCount: z.number().int().min(0),
  pendingReviewCount: z.number().int().min(0),
  latestQualityScore: z.number().nullable(),
  nextRecommendedSlot: z.string().nullable(),
  nextRecommendedSlotLabel: z.string().nullable(),
});

const vieCaptureWarningSchema = z.object({
  kind: z.enum([
    "missing_donor_final_extraction",
    "missing_graft_tray_overview",
    "missing_graft_tray_close",
    "missing_immediate_post_op",
    "pending_low_quality",
    "donor_alignment_inconsistent",
    "immediate_post_op_alignment_inconsistent",
  ]),
  label: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  slotSlug: z.string().optional(),
});

const vieSurgeryComparisonStatusSchema = z.object({
  donor_extraction_pair: z.enum(["ready", "partial", "missing"]),
  graft_tray_pair: z.enum(["ready", "partial", "missing"]),
  immediate_post_op_pair: z.enum(["ready", "partial", "missing"]),
});

const vieOutcomeStatusSchema = z.enum([
  "insufficient_evidence",
  "early_signal",
  "monitoring",
  "favourable",
  "concern",
  "audit_ready",
]);

const vieOutcomeReadinessSchema = z
  .object({
    overall_score: z.number().int().min(0).max(100),
    confidence_band: z.enum(["high", "medium", "low"]),
    audit_ready: z.boolean(),
    clinical_review_recommended: z.boolean(),
    surgical_healing: z.object({
      score: z.number().int().min(0).max(100),
      status: vieOutcomeStatusSchema,
      evidence_count: z.number().int().min(0),
    }),
    donor_recovery: z.object({
      score: z.number().int().min(0).max(100),
      status: vieOutcomeStatusSchema,
      evidence_count: z.number().int().min(0),
    }),
    documentation_readiness: z.object({
      score: z.number().int().min(0).max(100),
      status: vieOutcomeStatusSchema,
    }),
  })
  .nullable();

const vieCaptureSummarySchema = z.object({
  surgeryId: z.string().uuid(),
  patientId: z.string().uuid(),
  patientLabel: z.string(),
  caseId: z.string().uuid().nullable(),
  bookingId: z.string().uuid().nullable(),
  procedureDayId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  protocolSlug: z.literal("surgery_day"),
  surgicalDocumentationPercent: z.number().int().min(0).max(100),
  donorDocumentationPercent: z.number().int().min(0).max(100),
  graftTrayStatus: z.enum(["complete", "partial", "missing", "pending_review"]),
  immediatePostOpStatus: z.enum(["complete", "partial", "missing", "pending_review"]),
  phases: z.array(vieCapturePhaseSchema),
  warnings: z.array(vieCaptureWarningSchema),
  nextRecommendedSlot: z.string().nullable(),
  nextRecommendedSlotLabel: z.string().nullable(),
  comparisonStatus: vieSurgeryComparisonStatusSchema,
  outcomeReadiness: vieOutcomeReadinessSchema,
});

const liveProcedureTimelineItemSchema = z.object({
  stage: z.enum(LIVE_PROCEDURE_TIMELINE_STAGES),
  stageLabel: z.string(),
  eventLabel: z.string(),
  occurredAt: z.string(),
});

const liveProcedureStageDurationSchema = z.object({
  stage: z.enum(LIVE_PROCEDURE_TIMELINE_STAGES),
  stageLabel: z.string(),
  durationMinutes: z.number().int().min(0),
});

const liveProcedureDelaySignalSchema = z.object({
  kind: z.enum(["stage_overrun", "behind_schedule", "long_break"]),
  stage: z.enum(LIVE_PROCEDURE_TIMELINE_STAGES).nullable(),
  stageLabel: z.string().nullable(),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  elapsedMinutes: z.number().int().min(0),
  thresholdMinutes: z.number().int().min(0),
});

const liveProcedureTimelineSnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  currentStage: z.enum(LIVE_PROCEDURE_TIMELINE_STAGES).nullable(),
  currentStageLabel: z.string().nullable(),
  status: z.enum(["not_started", "in_progress", "paused", "completed", "cancelled"]),
  elapsedMinutes: z.number().int().min(0).nullable(),
  expectedCompletionTime: z.string().nullable(),
  timelineItems: z.array(liveProcedureTimelineItemSchema),
  stageDurations: z.array(liveProcedureStageDurationSchema),
  delaySignals: z.array(liveProcedureDelaySignalSchema),
  summary: z.string(),
});

const graftIntelligenceWarningSchema = z.object({
  kind: z.enum([
    "no_data",
    "composition_mismatch",
    "remaining_unaccounted",
    "over_implantation",
    "pending_tray_review",
    "reconciliation_incomplete",
    "low_confidence",
  ]),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});

const graftIntelligenceSnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  totalGrafts: z.number().int().min(0),
  totalHairs: z.number().int().min(0),
  averageHairsPerGraft: z.number().nullable(),
  singles: z.number().int().min(0),
  doubles: z.number().int().min(0),
  triples: z.number().int().min(0),
  multiples: z.number().int().min(0),
  multiHairGrafts: z.number().int().min(0),
  graftCountConfidence: z.number().int().min(0).max(100),
  reconciliationStatus: z.enum(SURGERY_OS_GRAFT_RECONCILIATION_STATUSES),
  extractionProgressPercent: z.number().int().min(0).max(100).nullable(),
  implantationProgressPercent: z.number().int().min(0).max(100).nullable(),
  summary: z.string(),
  warnings: z.array(graftIntelligenceWarningSchema),
});

const extractionVelocityHourlyBucketSchema = z.object({
  hourIndex: z.number().int().min(0),
  label: z.string(),
  graftsExtracted: z.number().int().min(0),
  ratePerHour: z.number().int().min(0),
});

const extractionVelocitySnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  graftsExtracted: z.number().int().min(0),
  extractionRatePerHour: z.number().int().min(0).nullable(),
  hourlyBreakdown: z.array(extractionVelocityHourlyBucketSchema),
  peakEfficiencyWindow: z.string().nullable(),
  efficiencyDeclinePercent: z.number().int().min(0).max(100).nullable(),
  fatigueSignal: z.boolean(),
  trendDirection: z.enum(["up", "down", "stable"]),
  summary: z.string(),
});

const transectionMonitoringWarningSchema = z.object({
  kind: z.enum(["no_data", "unclassified_damage", "pending_tray_review", "elevated_rate"]),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});

const transectionMonitoringSnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  totalGraftsReviewed: z.number().int().min(0),
  partialTransections: z.number().int().min(0),
  fullTransections: z.number().int().min(0),
  transectionRate: z.number().nullable(),
  qualityScore: z.number().int().min(0).max(100),
  status: z.enum(["excellent", "acceptable", "watch", "critical"]),
  warnings: z.array(transectionMonitoringWarningSchema),
  summary: z.string(),
});

const implantationSpeedSnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  implantedGrafts: z.number().int().min(0),
  implantationRatePerHour: z.number().int().min(0).nullable(),
  implantationDurationMinutes: z.number().int().min(0).nullable(),
  efficiencyScore: z.number().int().min(0).max(100),
  trendDirection: z.enum(["up", "down", "stable"]),
  summary: z.string(),
});

const surgicalDetectedRiskSchema = z.object({
  title: z.string(),
  severity: z.enum(["warning", "critical"]),
  recommendation: z.string(),
});

const surgicalRiskDetectionSnapshotSchema = z.object({
  surgeryId: z.string().uuid(),
  patientLabel: z.string(),
  totalRisks: z.number().int().min(0),
  criticalRisks: z.number().int().min(0),
  warningRisks: z.number().int().min(0),
  detectedRisks: z.array(surgicalDetectedRiskSchema),
  summary: z.string(),
});

const intelligenceSchema = z.object({
  policy: z.object({
    canExportCompetencyData: z.boolean(),
    canExportAuditData: z.boolean(),
    canBuildProfessionalGraph: z.boolean(),
    canSendToFiOs: z.boolean(),
    requiresConsent: z.boolean(),
    exportMode: z.enum(["disabled", "dev_only", "allowed"]),
  }),
  hints: z.array(
    z.object({
      signalKind: z.string(),
      title: z.string(),
      summary: z.string(),
      relatedWidget: z.string(),
      confidence: z.number(),
      exportEligible: z.boolean(),
    })
  ),
  generatedAt: z.string(),
});

export const surgeryOsCommandCentrePayloadSchema = z.object({
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  loadedAt: z.string(),
  operationalDay: operationalDaySchema,
  viewer: z.object({
    role: z.enum(SURGERY_OS_VIEWER_ROLES),
    staffRole: z.string().nullable(),
    visibleWidgets: z.array(z.enum(SURGERY_OS_WIDGET_KEYS)),
  }),
  liveSurgeries: z.array(liveSurgerySchema),
  readinessSnapshots: z.array(readinessSnapshotSchema),
  procedureTimeline: z.array(timelineEventSchema),
  teamAssignments: z.array(teamMemberSchema),
  alerts: z.array(alertSchema),
  operationalNotes: z.array(operationalNoteSchema),
  graftSummary: z.array(graftSummarySchema),
  graftEvents: z.array(graftCountEventSchema),
  vieCapture: z.array(vieCaptureSummarySchema),
  liveTimeline: z.array(liveProcedureTimelineSnapshotSchema),
  graftIntelligence: z.array(graftIntelligenceSnapshotSchema),
  extractionVelocity: z.array(extractionVelocitySnapshotSchema),
  transectionMonitoring: z.array(transectionMonitoringSnapshotSchema),
  implantationSpeed: z.array(implantationSpeedSnapshotSchema),
  surgicalRisks: z.array(surgicalRiskDetectionSnapshotSchema),
  intelligence: intelligenceSchema,
});

export function parseSurgeryOsCommandCentrePayload(input: unknown): SurgeryOsCommandCentrePayload {
  return surgeryOsCommandCentrePayloadSchema.parse(input);
}

export {
  liveSurgerySchema,
  readinessSnapshotSchema,
  timelineEventSchema,
  teamMemberSchema,
  alertSchema,
  operationalNoteSchema,
  graftSummarySchema,
  vieCaptureSummarySchema,
};
