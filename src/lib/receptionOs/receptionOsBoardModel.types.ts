import type { ReceptionOsSeverity, ReceptionOsWidgetKey } from "@/src/lib/receptionOs/receptionOsBoardModel";

export type ReceptionOsTodaysPatient = {
  id: string;
  patientName: string;
  appointmentType: string;
  appointmentTime: string;
  status: string;
  statusLabel: string;
  clinician: string;
  hrefs: {
    patient: string | null;
    case: string | null;
    lead: string | null;
    appointment: string;
  };
};

export type ReceptionOsCommunicationEvent = {
  id: string;
  kind: "sms" | "email" | "call" | "consultation_note" | "other";
  direction: string;
  subject: string | null;
  preview: string | null;
  patientOrLeadLabel: string;
  contactAt: string;
  hrefs: {
    patient: string | null;
    case: string | null;
    lead: string | null;
  };
};

export type ReceptionOsPipelineCard = {
  id: string;
  patientOrLeadLabel: string;
  column: import("@/src/lib/receptionOs/receptionOsBoardModel").ReceptionOsPipelineColumnId;
  detailLine: string | null;
  hrefs: {
    lead: string | null;
    patient: string | null;
    consultation: string | null;
    case: string | null;
  };
};

export type ReceptionOsDepositItem = {
  id: string;
  patientLabel: string;
  context: string;
  amountExpected: number;
  amountPaid: number;
  currency: string;
  dueDate: string | null;
  isOverdue: boolean;
  statusLabel: string;
  severity: ReceptionOsSeverity;
  paymentLink?: string | null;
  hrefs: {
    patient: string | null;
    case: string | null;
    lead: string | null;
  };
};

export type ReceptionOsSurgeryItem = {
  bookingId: string;
  patientLabel: string;
  surgeryDate: string;
  surgeryTime: string;
  daysUntil: number;
  staffAssigned: string | null;
  paymentComplete: boolean;
  consentComplete: boolean;
  readinessStatus: string;
  readinessPercent: number | null;
  severity: ReceptionOsSeverity;
  hrefs: {
    case: string | null;
    patient: string | null;
    calendar: string;
  };
};

export type ReceptionOsActionAlert = {
  id: string;
  kind: "missing_deposit" | "no_follow_up_after_consultation" | "missing_forms" | "surgery_risk";
  title: string;
  detail: string;
  severity: ReceptionOsSeverity;
  href: string | null;
  hrefs?: {
    patient: string | null;
    case: string | null;
    lead: string | null;
    consultation: string | null;
  };
};

import type { ReceptionOsDailyBrief } from "@/src/lib/receptionOs/receptionDailyBriefModel";
import type { ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";
import type {
  ReceptionOsConversionScoreboard,
  ReceptionOsRevenueRiskAlert,
  ReceptionOsRevenueSummary,
} from "@/src/lib/receptionOs/receptionOsRevenueModel";
import type { ReceptionTaskSourceType, ReceptionTaskStatus } from "@/src/lib/receptionOs/receptionTaskPolicy";

export type ReceptionOsTaskItem = {
  id: string;
  title: string;
  description: string | null;
  sourceType: ReceptionTaskSourceType;
  severity: ReceptionOsSeverity;
  status: ReceptionTaskStatus;
  ownerFiUserId: string | null;
  dueAt: string | null;
  patientId: string | null;
  caseId: string | null;
  leadId: string | null;
  bookingId: string | null;
  paymentId: string | null;
  consultationId: string | null;
  sourceAlertKind: string | null;
  sourceRefId: string | null;
  resolutionNotes: string | null;
  internalNotes: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceptionOsBoardPayload = {
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
    role: import("@/src/lib/receptionOs/receptionOsBoardModel").ReceptionOsViewerRole;
    visibleWidgets: readonly ReceptionOsWidgetKey[];
  };
  todaysPatients: ReceptionOsTodaysPatient[];
  communicationTimeline: ReceptionOsCommunicationEvent[];
  consultationPipeline: {
    columns: Record<
      import("@/src/lib/receptionOs/receptionOsBoardModel").ReceptionOsPipelineColumnId,
      ReceptionOsPipelineCard[]
    >;
    counts: Record<import("@/src/lib/receptionOs/receptionOsBoardModel").ReceptionOsPipelineColumnId, number>;
  };
  outstandingDeposits: ReceptionOsDepositItem[];
  upcomingSurgeries: ReceptionOsSurgeryItem[];
  actionAlerts: ReceptionOsActionAlert[];
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

/** Phase 2 command centre payload — extends V1 board with daily brief + task inbox. */
export type ReceptionOsCommandCentrePayload = ReceptionOsBoardPayload & {
  dailyBrief: ReceptionOsDailyBrief;
  receptionTasks: ReceptionOsTaskItem[];
  suggestedOperatingMode: ReceptionOsOperatingMode;
  /** Phase 3 — revenue + conversion intelligence (additive; V1 board fields unchanged). */
  revenueSummary: ReceptionOsRevenueSummary;
  conversionScoreboard: ReceptionOsConversionScoreboard;
  revenueRiskAlerts: ReceptionOsRevenueRiskAlert[];
  /** Phase 5 — end-of-day closeout snapshot. */
  endOfDayCloseout: import("@/src/lib/receptionOs/receptionDailyCloseoutModel").ReceptionCloseoutSnapshot;
  /** Phase 6 — pilot/production system status. */
  systemStatus: import("@/src/lib/receptionOs/receptionOsPilotStatusModel").ReceptionOsSystemStatus;
  /** Phase 7 — pilot metrics (admin/clinic_manager only). */
  pilotMetrics: import("@/src/lib/receptionOs/receptionPilotMetricsModel").ReceptionPilotMetricsPayload;
  /** Phase 8 — pilot review report (admin/clinic_manager only). */
  pilotReview: import("@/src/lib/receptionOs/receptionPilotReviewModel").ReceptionPilotReviewPayload;
  /** Phase 8 — owner value dashboard (admin/director). */
  ownerValue: import("@/src/lib/receptionOs/receptionOwnerValueModel").ReceptionOwnerValuePayload;
  /** Phase 8 — demo mode state for external demonstrations. */
  demoMode: import("@/src/lib/receptionOs/receptionOsDemoModeModel").ReceptionOsDemoModeState;
};

export const RECEPTION_OS_PIPELINE_COLUMN_IDS = [
  "new_lead",
  "consultation_booked",
  "consultation_completed",
  "quote_sent",
  "deposit_pending",
  "surgery_booked",
] as const;

export type ReceptionOsPipelineColumnId = (typeof RECEPTION_OS_PIPELINE_COLUMN_IDS)[number];

export const RECEPTION_OS_SEVERITIES = ["info", "warning", "critical", "blocked"] as const;
