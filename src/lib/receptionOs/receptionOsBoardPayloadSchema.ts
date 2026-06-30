/**
 * Client-safe ReceptionOS payload schema — shared by API route, refresh hook, and tests.
 */
import { z } from "zod";

import { RECEPTION_OS_PIPELINE_COLUMN_IDS } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type {
  ReceptionOsBoardPayload,
  ReceptionOsCommandCentrePayload,
  ReceptionOsPipelineColumnId,
} from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { RECEPTION_OS_OPERATING_MODES } from "@/src/lib/receptionOs/receptionOperatingMode";
import {
  RECEPTION_OS_REVENUE_CONFIDENCE_LEVELS,
  RECEPTION_OS_REVENUE_RISK_ALERT_KINDS,
} from "@/src/lib/receptionOs/receptionOsRevenueModel";
import {
  RECEPTION_TASK_SOURCE_TYPES,
  RECEPTION_TASK_STATUSES,
} from "@/src/lib/receptionOs/receptionTaskPolicy";

export {
  type ReceptionOsActionAlert,
  type ReceptionOsBoardPayload,
  type ReceptionOsCommandCentrePayload,
  type ReceptionOsCommunicationEvent,
  type ReceptionOsDepositItem,
  type ReceptionOsPipelineCard,
  type ReceptionOsSurgeryItem,
  type ReceptionOsTaskItem,
  type ReceptionOsTodaysPatient,
} from "@/src/lib/receptionOs/receptionOsBoardModel.types";

export { RECEPTION_OS_SEVERITIES } from "@/src/lib/receptionOs/receptionOsBoardModel";

const operationalDaySchema = z.object({
  calendarTimezone: z.string(),
  todayYmd: z.string(),
  localStartIso: z.string(),
  localEndIso: z.string(),
});

const recordHrefsSchema = z.object({
  patient: z.string().nullable(),
  case: z.string().nullable().optional(),
  lead: z.string().nullable().optional(),
  consultation: z.string().nullable().optional(),
  appointment: z.string().nullable().optional(),
  calendar: z.string().nullable().optional(),
});

const todaysPatientSchema = z.object({
  id: z.string().uuid(),
  patientName: z.string(),
  appointmentType: z.string(),
  appointmentTime: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  clinician: z.string(),
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    lead: z.string().nullable(),
    appointment: z.string(),
  }),
});

const communicationEventSchema = z.object({
  id: z.string(),
  kind: z.enum(["sms", "email", "call", "consultation_note", "other"]),
  direction: z.string(),
  subject: z.string().nullable(),
  preview: z.string().nullable(),
  patientOrLeadLabel: z.string(),
  contactAt: z.string(),
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    lead: z.string().nullable(),
  }),
});

const pipelineCardSchema = z.object({
  id: z.string(),
  patientOrLeadLabel: z.string(),
  column: z.enum(RECEPTION_OS_PIPELINE_COLUMN_IDS),
  detailLine: z.string().nullable(),
  hrefs: z.object({
    lead: z.string().nullable(),
    patient: z.string().nullable(),
    consultation: z.string().nullable(),
    case: z.string().nullable(),
  }),
});

const depositItemSchema = z.object({
  id: z.string().uuid(),
  patientLabel: z.string(),
  context: z.string(),
  amountExpected: z.number(),
  amountPaid: z.number(),
  currency: z.string(),
  dueDate: z.string().nullable(),
  isOverdue: z.boolean(),
  statusLabel: z.string(),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  paymentLink: z.string().nullable().optional(),
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    lead: z.string().nullable(),
  }),
});

const surgeryItemSchema = z.object({
  bookingId: z.string().uuid(),
  patientLabel: z.string(),
  surgeryDate: z.string(),
  surgeryTime: z.string(),
  daysUntil: z.number().int(),
  staffAssigned: z.string().nullable(),
  paymentComplete: z.boolean(),
  consentComplete: z.boolean(),
  readinessStatus: z.string(),
  readinessPercent: z.number().nullable(),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  hrefs: z.object({
    case: z.string().nullable(),
    patient: z.string().nullable(),
    calendar: z.string(),
  }),
});

const actionAlertSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "missing_deposit",
    "no_follow_up_after_consultation",
    "missing_forms",
    "surgery_risk",
  ]),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  href: z.string().nullable(),
  hrefs: z
    .object({
      patient: z.string().nullable(),
      case: z.string().nullable(),
      lead: z.string().nullable(),
      consultation: z.string().nullable(),
    })
    .optional(),
});

const intelligenceHintSchema = z.object({
  signalKind: z.string(),
  title: z.string(),
  summary: z.string(),
  relatedWidget: z.string(),
  confidence: z.number(),
  exportEligible: z.boolean(),
});

const dailyBriefSchema = z.object({
  todayPatientCount: z.number().int().nonnegative(),
  outstandingDepositCount: z.number().int().nonnegative(),
  overdueDepositCount: z.number().int().nonnegative(),
  surgeryNext14Count: z.number().int().nonnegative(),
  surgeryRiskCount: z.number().int().nonnegative(),
  followUpNeededCount: z.number().int().nonnegative(),
  openTaskCount: z.number().int().nonnegative(),
  alertsBySeverity: z.object({
    info: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
  }),
  projectedOperationalRisk: z.enum(["info", "warning", "critical", "blocked"]),
  summaryLines: z.array(z.string()),
});

const receptionTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  sourceType: z.enum(RECEPTION_TASK_SOURCE_TYPES),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  status: z.enum(RECEPTION_TASK_STATUSES),
  ownerFiUserId: z.string().uuid().nullable(),
  dueAt: z.string().nullable(),
  patientId: z.string().uuid().nullable(),
  caseId: z.string().uuid().nullable(),
  leadId: z.string().uuid().nullable(),
  bookingId: z.string().uuid().nullable(),
  paymentId: z.string().uuid().nullable(),
  consultationId: z.string().uuid().nullable(),
  sourceAlertKind: z.string().nullable(),
  sourceRefId: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  internalNotes: z.string().nullable(),
  snoozedUntil: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const revenueScoreSchema = z.object({
  subjectId: z.string(),
  label: z.string(),
  probabilityPercent: z.number().int().min(0).max(100),
  confidenceLevel: z.enum(RECEPTION_OS_REVENUE_CONFIDENCE_LEVELS),
  weightedRevenue: z.number().nonnegative(),
  currency: z.string(),
  riskFlags: z.array(z.string()),
  recommendedNextAction: z.string(),
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    lead: z.string().nullable(),
    consultation: z.string().nullable(),
  }),
});

const revenueSummarySchema = z.object({
  totalWeightedRevenue: z.number().nonnegative(),
  totalAtRiskRevenue: z.number().nonnegative(),
  currency: z.string(),
  scoredSubjectCount: z.number().int().nonnegative(),
  averageProbabilityPercent: z.number().int().min(0).max(100),
  topOpportunities: z.array(revenueScoreSchema),
});

const conversionScoreboardSchema = z.object({
  consultsCompletedToday: z.number().int().nonnegative(),
  quotesSentToday: z.number().int().nonnegative(),
  depositsCollectedToday: z.number().int().nonnegative(),
  surgeryBookingsCreatedToday: z.number().int().nonnegative(),
  projectedWeightedRevenue: z.number().nonnegative(),
  atRiskRevenue: z.number().nonnegative(),
  currency: z.string(),
});

const revenueRiskAlertSchema = z.object({
  id: z.string(),
  kind: z.enum(RECEPTION_OS_REVENUE_RISK_ALERT_KINDS),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical", "blocked"]),
  estimatedRevenueAtRisk: z.number().nullable(),
  currency: z.string(),
  href: z.string().nullable(),
  hrefs: z.object({
    patient: z.string().nullable(),
    case: z.string().nullable(),
    lead: z.string().nullable(),
    consultation: z.string().nullable(),
  }),
  recommendedAction: z.string(),
});

const closeoutChecklistItemSchema = z.object({
  itemKind: z.enum([
    "unresolved_critical_task",
    "unresolved_blocked_task",
    "unpaid_deposit_due_today",
    "incomplete_surgery_readiness",
    "consultation_no_next_action",
    "communication_failed",
    "tomorrow_first_patient_readiness",
  ]),
  severity: z.enum(["info", "warning", "critical", "blocked"]).nullable(),
  status: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable(),
  sourceRefId: z.string().nullable(),
  href: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const failedCommunicationSchema = z.object({
  id: z.string(),
  channel: z.enum(["sms", "email"]),
  provider: z.string(),
  deliveryStatus: z.enum(["draft", "dry_run", "queued", "sent", "failed"]),
  errorMessage: z.string().nullable(),
  sentAt: z.string().nullable(),
  templateKey: z.string().nullable(),
  toAddress: z.string().nullable(),
  externalMessageId: z.string().nullable(),
  leadId: z.string().nullable(),
  patientId: z.string().nullable(),
  createdAt: z.string(),
});

const endOfDayCloseoutSchema = z.object({
  operatingDate: z.string(),
  riskSummary: z.string(),
  itemCounts: z.object({
    info: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    failed_communications: z.number().int().nonnegative(),
  }),
  checklist: z.array(closeoutChecklistItemSchema),
  failedCommunications: z.array(failedCommunicationSchema),
  canCloseDay: z.boolean(),
  existingCloseoutId: z.string().nullable(),
  existingCloseoutNotes: z.string().nullable(),
  closedAt: z.string().nullable(),
});

const pilotBannerSchema = z.object({
  variant: z.enum(["info", "warning", "success", "danger"]),
  title: z.string(),
  message: z.string(),
});

const systemStatusSchema = z.object({
  dryRunEnabled: z.boolean(),
  emailSendEnabled: z.boolean(),
  smsSendEnabled: z.boolean(),
  providerMode: z.enum(["dry_run", "stub", "live_email", "live_sms", "live_both", "live_blocked"]),
  resendConfigured: z.boolean(),
  twilioConfigured: z.boolean(),
  pilotModeActive: z.boolean(),
  pilotBanner: pilotBannerSchema.nullable(),
  lastPayloadLoadedAt: z.string(),
  failedSendsToday: z.number().int().nonnegative(),
  closeoutStatus: z.enum(["open", "closed"]),
  closeoutOperatingDate: z.string(),
  envChecklist: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      present: z.boolean(),
      optional: z.boolean().optional(),
    })
  ),
});

const pilotMetricsSummarySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  dailyActiveUsers: z.number().int().nonnegative(),
  tasksCreated: z.number().int().nonnegative(),
  tasksResolved: z.number().int().nonnegative(),
  averageTaskResolutionMinutes: z.number().int().nonnegative().nullable(),
  unresolvedCriticalRisks: z.number().int().nonnegative(),
  communicationsDrafted: z.number().int().nonnegative(),
  communicationsSent: z.number().int().nonnegative(),
  communicationsDryRun: z.number().int().nonnegative(),
  closeoutsCompleted: z.number().int().nonnegative(),
  mostUsedWidgets: z.array(
    z.object({
      widgetKey: z.string(),
      viewCount: z.number().int().nonnegative(),
    })
  ),
  topFeedbackIssues: z.array(
    z.object({
      feedbackKind: z.enum(["useful", "missing_information", "wrong_alert", "workflow_friction"]),
      count: z.number().int().nonnegative(),
      label: z.string(),
    })
  ),
});

const pilotManagerScoresSchema = z.object({
  adoptionScore: z.number().int().min(0).max(100),
  workflowCompletionScore: z.number().int().min(0).max(100),
  riskClosureScore: z.number().int().min(0).max(100),
  feedbackCount: z.number().int().nonnegative(),
  topFrictionPoints: z.array(
    z.object({
      label: z.string(),
      count: z.number().int().nonnegative(),
    })
  ),
});

const pilotMetricsSchema = z.object({
  visible: z.boolean(),
  summary: pilotMetricsSummarySchema.nullable(),
  managerScores: pilotManagerScoresSchema.nullable(),
});

const pilotReviewReportSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  periodDays: z.number().int().positive(),
  activeUsers: z.number().int().nonnegative(),
  tasksCreated: z.number().int().nonnegative(),
  tasksResolved: z.number().int().nonnegative(),
  risksClosed: z.number().int().nonnegative(),
  revenueAtRiskIdentified: z.number().nonnegative(),
  currency: z.string(),
  depositsChased: z.number().int().nonnegative(),
  communicationsDrafted: z.number().int().nonnegative(),
  communicationsSent: z.number().int().nonnegative(),
  communicationsDryRun: z.number().int().nonnegative(),
  closeoutsCompleted: z.number().int().nonnegative(),
  averageResponseTimeMinutes: z.number().int().nonnegative().nullable(),
  topWorkflowIssues: z.array(
    z.object({
      feedbackKind: z.enum(["useful", "missing_information", "wrong_alert", "workflow_friction"]),
      count: z.number().int().nonnegative(),
      label: z.string(),
    })
  ),
  mostValuableWidgets: z.array(
    z.object({
      widgetKey: z.string(),
      viewCount: z.number().int().nonnegative(),
    })
  ),
});

const pilotReviewSchema = z.object({
  visible: z.boolean(),
  periodDays: z.number().int().positive(),
  report: pilotReviewReportSchema.nullable(),
});

const ownerValueDashboardSchema = z.object({
  estimatedRevenueProtected: z.number().nonnegative(),
  currency: z.string(),
  operationalRisksClosed: z.number().int().nonnegative(),
  averageResponseTimeMinutes: z.number().int().nonnegative().nullable(),
  conversionActionsTaken: z.number().int().nonnegative(),
  staffAdoptionScore: z.number().int().min(0).max(100),
  pilotFeedbackScore: z.number().int().min(0).max(100),
});

const ownerValueSchema = z.object({
  visible: z.boolean(),
  dashboard: ownerValueDashboardSchema.nullable(),
});

const demoModeSchema = z.object({
  active: z.boolean(),
  maskAmounts: z.boolean(),
  usingSampleData: z.boolean(),
  canToggle: z.boolean(),
});

const moduleHealthSchema = z.object({
  coreBoardLoaded: z.boolean(),
  unavailableModules: z.array(
    z.object({
      module: z.enum([
        "board_sections",
        "tasks",
        "revenue_activity",
        "closeout",
        "system_status",
        "pilot_metrics",
        "pilot_review",
        "owner_value",
        "demo_mode",
        "export",
      ]),
      label: z.string(),
      message: z.string(),
    })
  ),
});

export const receptionOsBoardPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  loadedAt: z.string(),
  operationalDay: operationalDaySchema,
  viewer: z.object({
    role: z.enum(["receptionist", "admin", "consultant", "clinic_manager"]),
    visibleWidgets: z.array(
      z.enum([
        "todays_patients",
        "communication_timeline",
        "consultation_pipeline",
        "outstanding_deposits",
        "upcoming_surgery",
        "action_alerts",
      ])
    ),
  }),
  todaysPatients: z.array(todaysPatientSchema),
  communicationTimeline: z.array(communicationEventSchema),
  consultationPipeline: z.object({
    columns: z.record(z.enum(RECEPTION_OS_PIPELINE_COLUMN_IDS), z.array(pipelineCardSchema)),
    counts: z.record(z.enum(RECEPTION_OS_PIPELINE_COLUMN_IDS), z.number().int().nonnegative()),
  }),
  outstandingDeposits: z.array(depositItemSchema),
  upcomingSurgeries: z.array(surgeryItemSchema),
  actionAlerts: z.array(actionAlertSchema),
  intelligence: z.object({
    policy: z.object({
      canExportCompetencyData: z.boolean(),
      canExportAuditData: z.boolean(),
      canBuildProfessionalGraph: z.boolean(),
      canSendToFiOs: z.boolean(),
      requiresConsent: z.boolean(),
      exportMode: z.enum(["disabled", "dev_only", "allowed"]),
    }),
    hints: z.array(intelligenceHintSchema),
    generatedAt: z.string(),
  }),
});

export const receptionOsCommandCentrePayloadSchema = receptionOsBoardPayloadSchema.extend({
  dailyBrief: dailyBriefSchema,
  receptionTasks: z.array(receptionTaskSchema),
  suggestedOperatingMode: z.enum(RECEPTION_OS_OPERATING_MODES),
  revenueSummary: revenueSummarySchema,
  conversionScoreboard: conversionScoreboardSchema,
  revenueRiskAlerts: z.array(revenueRiskAlertSchema),
  endOfDayCloseout: endOfDayCloseoutSchema,
  systemStatus: systemStatusSchema,
  pilotMetrics: pilotMetricsSchema,
  pilotReview: pilotReviewSchema,
  ownerValue: ownerValueSchema,
  demoMode: demoModeSchema,
  moduleHealth: moduleHealthSchema,
});

export const receptionOsApiResponseSchema = z.object({
  data: receptionOsCommandCentrePayloadSchema,
});

export function parseReceptionOsBoardPayload(raw: unknown): ReceptionOsBoardPayload {
  return receptionOsBoardPayloadSchema.parse(raw) as ReceptionOsBoardPayload;
}

export function parseReceptionOsCommandCentrePayload(
  raw: unknown
): ReceptionOsCommandCentrePayload {
  return receptionOsCommandCentrePayloadSchema.parse(raw) as ReceptionOsCommandCentrePayload;
}

export function emptyPipelineCounts(): Record<ReceptionOsPipelineColumnId, number> {
  return {
    new_lead: 0,
    consultation_booked: 0,
    consultation_completed: 0,
    quote_sent: 0,
    deposit_pending: 0,
    surgery_booked: 0,
  };
}

export {
  recordHrefsSchema,
  todaysPatientSchema,
  depositItemSchema,
  surgeryItemSchema,
  actionAlertSchema,
  pipelineCardSchema,
  communicationEventSchema,
  dailyBriefSchema,
  receptionTaskSchema,
  revenueSummarySchema,
  conversionScoreboardSchema,
  revenueRiskAlertSchema,
  revenueScoreSchema,
};
