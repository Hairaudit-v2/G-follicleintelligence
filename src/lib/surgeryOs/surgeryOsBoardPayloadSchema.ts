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
  GRAFT_TRAY_AI_PROVIDERS,
  GRAFT_TRAY_AI_REVIEW_ACTIONS,
  GRAFT_TRAY_AI_REVIEW_STATUSES,
  GRAFT_TRAY_CONFIDENCE_BANDS,
  GRAFT_TRAY_IMAGE_QUALITIES,
  GRAFT_TRAY_MISMATCH_BANDS,
} from "@/src/lib/imaging-os/graftTrayCountTypes";
import { GRAFT_TRAY_FINAL_COUNT_SOURCES } from "@/src/lib/imaging-os/graftTrayIntelligenceSummaryCore";
import { HAIRAUDIT_LINK_ORIGINS } from "@/src/lib/outcomeIntelligence/hairAuditLinkCore";
import { SURGERY_CASE_INTELLIGENCE_FACTS_VERSION } from "@/src/lib/outcomeIntelligence/surgeryCaseFactsCore";
import {
  LONGITUDINAL_COMPARISON_WINDOWS,
  LONGITUDINAL_EVIDENCE_STATUSES,
} from "@/src/lib/outcomeIntelligence/longitudinalOutcomeComparisonCore";
import { SURGERY_IMAGING_INTELLIGENCE_GROUPS } from "@/src/lib/outcomeIntelligence/surgeryImagingIntelligenceSummaryCore";
import { GRAFT_TRAY_AI_REVIEW_DISPLAY_STATES } from "@/src/lib/imaging-os/graftTrayReviewUxCore";
import {
  SURGERY_OS_GRAFT_COUNT_EVENT_TYPES,
  SURGERY_OS_GRAFT_SESSION_PHASES,
} from "@/src/lib/surgeryOs/surgeryOsGraftCounting";
import { SURGERY_OS_GRAFT_RECONCILIATION_STATUSES } from "@/src/lib/surgeryOs/surgeryOsGraftReconciliation";
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
  SurgeonPerformanceSnapshot,
  SurgeryBenchmarkSnapshot,
  SurgeonConsistencySnapshot,
  SurgeonRiskPatternSnapshot,
  SurgeonPerformanceScoreSnapshot,
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

export const graftTrayAiEstimateSummarySchema = z.object({
  estimateId: z.string().uuid(),
  estimatedGraftCount: z.number().int().nullable(),
  manualGraftCount: z.number().int().nullable(),
  mismatchBand: z.enum(GRAFT_TRAY_MISMATCH_BANDS),
  delta: z.number().int().nullable(),
  confidence: z.number(),
  confidenceBand: z.enum(GRAFT_TRAY_CONFIDENCE_BANDS),
  reviewStatus: z.enum(GRAFT_TRAY_AI_REVIEW_STATUSES),
  reviewerDecision: z.enum(GRAFT_TRAY_AI_REVIEW_ACTIONS).nullable(),
  correctedCount: z.number().int().nullable(),
  provider: z.enum(GRAFT_TRAY_AI_PROVIDERS),
  displayState: z.enum(GRAFT_TRAY_AI_REVIEW_DISPLAY_STATES),
  displayLabel: z.string(),
  requiresStaffReview: z.boolean(),
  finalAcceptedCount: z.number().int().nullable(),
  reviewWarnings: z.array(z.string()),
});

const graftTrayReviewAuditEntrySchema = z.object({
  reviewed_at: z.string(),
  reviewed_by_fi_user_id: z.string().nullable(),
  decision: z.enum(GRAFT_TRAY_AI_REVIEW_ACTIONS),
  review_status: z.enum(GRAFT_TRAY_AI_REVIEW_STATUSES),
  previous_ai_estimate: z.number().int().nullable(),
  previous_manual_count: z.number().int().nullable(),
  final_accepted_count: z.number().int().nullable(),
  staff_note: z.string().nullable(),
});

export const graftTrayIntelligenceSummarySchema = z.object({
  estimateId: z.string().uuid(),
  imageId: z.string().uuid(),
  graftTrayLinkId: z.string().uuid().nullable(),
  hasFinalCount: z.boolean(),
  finalAcceptedCount: z.number().int().nullable(),
  originalAiEstimate: z.number().int().nullable(),
  manualCount: z.number().int().nullable(),
  varianceDelta: z.number().int().nullable(),
  mismatchBand: z.enum(GRAFT_TRAY_MISMATCH_BANDS),
  confidenceBand: z.enum(GRAFT_TRAY_CONFIDENCE_BANDS),
  imageQuality: z.enum(GRAFT_TRAY_IMAGE_QUALITIES),
  reviewDecision: z.enum(GRAFT_TRAY_AI_REVIEW_ACTIONS).nullable(),
  reviewStatus: z.enum(GRAFT_TRAY_AI_REVIEW_STATUSES),
  displayState: z.enum(GRAFT_TRAY_AI_REVIEW_DISPLAY_STATES),
  reviewerId: z.string().nullable(),
  reviewerLabel: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  finalCountSource: z.enum(GRAFT_TRAY_FINAL_COUNT_SOURCES).nullable(),
  isReadOnly: z.boolean(),
  supersededStaleJob: z.boolean(),
  sourceImageHref: z.string().nullable(),
  reviewAuditTrail: z.array(graftTrayReviewAuditEntrySchema),
  warnings: z.array(z.string()),
});

const graftTrayCaseIntelligenceSummarySchema = z.object({
  reviewedTrayCount: z.number().int().min(0),
  pendingReviewCount: z.number().int().min(0),
  supersededStaleCount: z.number().int().min(0),
  totalFinalAcceptedGrafts: z.number().int().nullable(),
  hasSupersededStaleEstimate: z.boolean(),
});

const graftTrayLinkSummarySchema = z.object({
  linkId: z.string().uuid(),
  imageId: z.string().uuid(),
  capturedAt: z.string(),
  status: z.string(),
  reviewRequired: z.boolean(),
  imagingHref: z.string().nullable(),
  aiEstimate: graftTrayAiEstimateSummarySchema.nullable(),
  intelligenceSummary: graftTrayIntelligenceSummarySchema.nullable(),
});

const surgeryCaseGraftTrayLinkFactsSchema = z.object({
  link_id: z.string().uuid(),
  image_id: z.string().uuid(),
  estimate_id: z.string().uuid().nullable(),
  final_accepted_count: z.number().int().nullable(),
  ai_estimate: z.number().int().nullable(),
  manual_count: z.number().int().nullable(),
  graft_count_source: z.enum(GRAFT_TRAY_FINAL_COUNT_SOURCES).nullable(),
  mismatch_band: z.string().nullable(),
  confidence_band: z.string().nullable(),
  image_quality: z.string().nullable(),
  reviewer_id: z.string().nullable(),
  reviewer_label: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  superseded_stale_job: z.boolean(),
  has_final_count: z.boolean(),
});

const surgeryImagingGroupSummarySchema = z.object({
  group: z.enum(SURGERY_IMAGING_INTELLIGENCE_GROUPS),
  image_count: z.number().int().min(0),
  usable_image_count: z.number().int().min(0),
  poor_quality_count: z.number().int().min(0),
  image_ids: z.array(z.string().uuid()),
  present_views: z.array(z.string()),
  missing_required_views: z.array(z.string()),
  complete: z.boolean(),
});

const surgeryImagingAuditReadinessSchema = z.object({
  baseline_present: z.boolean(),
  donor_set_complete: z.boolean(),
  recipient_set_complete: z.boolean(),
  immediate_post_op_present: z.boolean(),
  follow_up_captured_or_due: z.boolean(),
  reviewed_graft_count_present: z.boolean(),
  hairaudit_link_resolved: z.boolean(),
  hairaudit_linkage_conflict: z.boolean(),
  before_after_ready: z.boolean(),
  overall_audit_ready: z.boolean(),
  missing_requirements: z.array(z.string()),
});

const longitudinalImageSetSummarySchema = z.object({
  image_ids: z.array(z.string().uuid()),
  usable_image_count: z.number().int().min(0),
  poor_quality_count: z.number().int().min(0),
  present_views: z.array(z.string()),
  missing_required_views: z.array(z.string()),
  complete: z.boolean(),
});

const longitudinalComparisonReadinessSchema = z.object({
  ready_for_comparison: z.boolean(),
  outcome_measured: z.boolean(),
  missing_comparison_views: z.array(z.string()),
});

const followUpWindowStatusSchema = z.object({
  window: z.enum(LONGITUDINAL_COMPARISON_WINDOWS),
  due: z.boolean(),
  captured: z.boolean(),
  captured_at: z.string().nullable(),
  ready_for_comparison: z.boolean(),
  outcome_measured: z.boolean(),
});

const longitudinalOutcomeSummaryFactsSchema = z.object({
  baseline_image_set: longitudinalImageSetSummarySchema,
  immediate_post_op_image_set: longitudinalImageSetSummarySchema,
  follow_up_image_set: longitudinalImageSetSummarySchema,
  comparison_readiness: longitudinalComparisonReadinessSchema,
  donor_recovery_evidence_status: z.enum(LONGITUDINAL_EVIDENCE_STATUSES),
  recipient_growth_evidence_status: z.enum(LONGITUDINAL_EVIDENCE_STATUSES),
  before_after_ready: z.boolean(),
  hairaudit_report_ready: z.boolean(),
  follow_up_windows: z.array(followUpWindowStatusSchema),
  active_follow_up_window: z.enum(LONGITUDINAL_COMPARISON_WINDOWS).nullable(),
  missing_outcome_evidence: z.array(z.string()),
  hairaudit_case_id: z.string().uuid().nullable(),
  hairaudit_report_id: z.string().uuid().nullable(),
});

const surgeryImagingIntelligenceSummaryFactsSchema = z.object({
  groups: z.array(surgeryImagingGroupSummarySchema),
  missing_required_views: z.array(z.string()),
  poor_quality_image_ids: z.array(z.string().uuid()),
  audit_readiness: surgeryImagingAuditReadinessSchema,
  completeness_score: z.number().int().min(0).max(100),
  hairaudit_case_id: z.string().uuid().nullable(),
  hairaudit_link_origin: z.enum(HAIRAUDIT_LINK_ORIGINS).nullable(),
});

const graftTrayOutcomeFactSchema = z.object({
  fact_kind: z.literal("graft_tray_reviewed_count"),
  source_table: z.literal("fi_imaging_graft_tray_ai_estimates"),
  source_id: z.string().uuid(),
  image_id: z.string().uuid(),
  captured_at: z.string(),
  confidence_level: z.enum(["unknown", "low", "medium", "high"]),
  metric_values: z.object({
    graft_tray_final_count: z.number().int().nullable(),
    graft_tray_ai_estimate: z.number().int().nullable(),
    graft_tray_manual_count: z.number().int().nullable(),
    graft_tray_variance_delta: z.number().int().nullable(),
    graft_tray_mismatch_band: z.string(),
    graft_tray_confidence_band: z.string(),
    graft_tray_image_quality: z.string(),
    graft_tray_final_count_source: z.string().nullable(),
    graft_tray_review_complete: z.boolean(),
    graft_tray_superseded_stale: z.boolean(),
  }),
});

export const surgeryCaseIntelligenceFactsSchema = z.object({
  facts_version: z.literal(SURGERY_CASE_INTELLIGENCE_FACTS_VERSION),
  tenant_id: z.string().uuid(),
  patient_id: z.string().uuid().nullable(),
  case_id: z.string().uuid().nullable(),
  surgery_id: z.string().uuid(),
  booking_id: z.string().uuid().nullable(),
  procedure_date: z.string().nullable(),
  final_reviewed_graft_count: z.number().int().nullable(),
  graft_tray_ai_estimate: z.number().int().nullable(),
  graft_tray_manual_count: z.number().int().nullable(),
  graft_count_source: z.enum(GRAFT_TRAY_FINAL_COUNT_SOURCES).nullable(),
  mismatch_band: z.string().nullable(),
  confidence_band: z.string().nullable(),
  image_quality: z.string().nullable(),
  reviewer_id: z.string().nullable(),
  reviewer_label: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  has_final_graft_count: z.boolean(),
  graft_tray_review_pending: z.boolean(),
  superseded_stale_estimate: z.boolean(),
  graft_session_id: z.string().uuid().nullable(),
  target_grafts: z.number().int().nullable(),
  extracted_grafts: z.number().int().min(0),
  implanted_grafts: z.number().int().min(0),
  discarded_grafts: z.number().int().min(0),
  remaining_grafts: z.number().int(),
  reconciliation_status: z.string(),
  graft_session_phase: z.string(),
  reconciled_at: z.string().nullable(),
  confirmed_tray_grafts: z.number().int().min(0),
  surgery_status: z.string().nullable(),
  procedure_phase: z.string().nullable(),
  live_status: z.string().nullable(),
  surgeon_fi_user_id: z.string().nullable(),
  team_fi_user_ids: z.array(z.string()),
  graft_tray_image_ids: z.array(z.string().uuid()),
  graft_tray_link_ids: z.array(z.string().uuid()),
  graft_tray_links: z.array(surgeryCaseGraftTrayLinkFactsSchema),
  graft_tray_outcome_facts: z.array(graftTrayOutcomeFactSchema),
  confidence_level: z.enum(["unknown", "low", "medium", "high"]),
  imaging_intelligence_summary: z.preprocess(
    (value) => value ?? null,
    surgeryImagingIntelligenceSummaryFactsSchema.nullable()
  ),
  longitudinal_outcome_summary: z.preprocess(
    (value) => value ?? null,
    longitudinalOutcomeSummaryFactsSchema.nullable()
  ),
  before_after_ready: z.preprocess((value) => value ?? false, z.boolean()),
  donor_recovery_ready: z.preprocess((value) => value ?? false, z.boolean()),
  recipient_growth_ready: z.preprocess((value) => value ?? false, z.boolean()),
  follow_up_window_status: z.preprocess(
    (value) => value ?? [],
    z.array(followUpWindowStatusSchema)
  ),
  missing_outcome_evidence: z.preprocess((value) => value ?? [], z.array(z.string())),
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
  trayImageCount: z.number().int().min(0),
  trayImageLinks: z.array(graftTrayLinkSummarySchema),
  graftTrayIntelligence: graftTrayCaseIntelligenceSummarySchema.nullable(),
  caseIntelligenceFacts: surgeryCaseIntelligenceFactsSchema.nullable(),
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

const surgeonPerformanceSnapshotSchema = z.object({
  surgeonId: z.string().uuid(),
  surgeonName: z.string(),
  proceduresCompleted: z.number().int().min(0),
  averageProcedureDuration: z.number().nullable(),
  averageExtractionVelocity: z.number().nullable(),
  averageImplantationSpeed: z.number().nullable(),
  averageTransectionRate: z.number().nullable(),
  averageHairsPerGraft: z.number().nullable(),
  consistencyScore: z.number().int().min(0).max(100),
  performanceScore: z.number().int().min(0).max(100),
  performanceGrade: z.enum(["elite", "excellent", "strong", "watch", "poor"]),
  trendDirection: z.enum(["improving", "stable", "declining"]),
  summary: z.string(),
});

const surgeryBenchmarkDeviationSchema = z.object({
  extractionVelocity: z.number().nullable(),
  implantationSpeed: z.number().nullable(),
  transectionRate: z.number().nullable(),
  procedureDuration: z.number().nullable(),
  graftComposition: z.number().nullable(),
});

const surgeryBenchmarkSnapshotSchema = z.object({
  surgeonId: z.string().uuid(),
  surgeonName: z.string(),
  surgeonBenchmarkRank: z.number().int().min(1).nullable(),
  clinicAverageExtractionVelocity: z.number().nullable(),
  clinicAverageTransectionRate: z.number().nullable(),
  clinicAverageImplantationSpeed: z.number().nullable(),
  clinicAverageDurationMinutes: z.number().nullable(),
  clinicAverageHairsPerGraft: z.number().nullable(),
  deviationPercentages: surgeryBenchmarkDeviationSchema,
  benchmarkStatus: z.enum(["above_average", "average", "below_average"]),
  summary: z.string(),
});

const surgeonConsistencySnapshotSchema = z.object({
  surgeonId: z.string().uuid(),
  surgeonName: z.string(),
  consistencyScore: z.number().int().min(0).max(100),
  extractionVariance: z.number().nullable(),
  transectionVariance: z.number().nullable(),
  durationVariance: z.number().nullable(),
  graftVariance: z.number().nullable(),
  status: z.enum(["elite", "stable", "inconsistent", "concerning"]),
  summary: z.string(),
});

const surgeonDetectedRiskPatternSchema = z.object({
  title: z.string(),
  severity: z.enum(["warning", "critical"]),
  recommendation: z.string(),
});

const surgeonRiskPatternSnapshotSchema = z.object({
  surgeonId: z.string().uuid(),
  surgeonName: z.string(),
  totalRisks: z.number().int().min(0),
  detectedPatterns: z.array(surgeonDetectedRiskPatternSchema),
  summary: z.string(),
});

const surgeonPerformanceScoreSnapshotSchema = z.object({
  surgeonId: z.string().uuid(),
  surgeonName: z.string(),
  score: z.number().int().min(0).max(100),
  grade: z.enum(["elite", "excellent", "strong", "watch", "poor"]),
  percentile: z.number().int().min(0).max(100).nullable(),
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
  surgeonPerformance: z.array(surgeonPerformanceSnapshotSchema),
  surgeryBenchmarks: z.array(surgeryBenchmarkSnapshotSchema),
  surgeonConsistency: z.array(surgeonConsistencySnapshotSchema),
  surgeonRiskPatterns: z.array(surgeonRiskPatternSnapshotSchema),
  surgeonPerformanceScores: z.array(surgeonPerformanceScoreSnapshotSchema),
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
