import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { SurgeryReadinessBoardCard } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import type { ReceptionBoardFlowActionKind } from "@/src/lib/fiOs/receptionBoardFlowPolicy";

/** Operational status surfaced on today's appointment cards (Sprint 2 spec). */
export const RECEPTION_BOARD_OPERATIONAL_STATUSES = [
  "scheduled",
  "confirmed",
  "arrived",
  "checked_in",
  "waiting",
  "in_consultation",
  "in_procedure",
  "completed",
  "cancelled",
  "rescheduled",
] as const;

export type ReceptionBoardOperationalStatus =
  (typeof RECEPTION_BOARD_OPERATIONAL_STATUSES)[number];

/** Live arrival queue columns (front-desk workflow). */
export const RECEPTION_BOARD_QUEUE_COLUMN_IDS = [
  "scheduled",
  "arrived",
  "checked_in",
  "waiting",
  "in_consultation",
  "procedure_in_progress",
  "completed",
  "follow_up_booked",
] as const;

export type ReceptionBoardQueueColumnId =
  (typeof RECEPTION_BOARD_QUEUE_COLUMN_IDS)[number];

export const RECEPTION_BOARD_QUEUE_COLUMN_LABELS: Record<
  ReceptionBoardQueueColumnId,
  string
> = {
  scheduled: "Scheduled",
  arrived: "Arrived",
  checked_in: "Checked in",
  waiting: "Waiting",
  in_consultation: "In consultation",
  procedure_in_progress: "Procedure in progress",
  completed: "Completed",
  follow_up_booked: "Follow up booked",
};

export type ReceptionBoardAppointmentCard = {
  id: string;
  patientName: string;
  appointmentTime: string;
  appointmentType: string;
  clinician: string;
  status: ReceptionBoardOperationalStatus;
  statusLabel: string;
  durationMinutes: number | null;
  room: string | null;
  paymentStatus: "paid" | "due" | "overdue" | "not_required" | "unknown";
  paymentStatusLabel: string;
  confirmationStatus: "confirmed" | "unconfirmed" | "cancelled";
  journeyState: string | null;
  journeyStateLabel: string | null;
  sortKey: string;
  hrefs: {
    patient: string | null;
    case: string | null;
    lead: string | null;
    appointment: string;
    calendar: string;
  };
};

export type ReceptionBoardQueueItem = {
  bookingId: string;
  patientName: string;
  appointmentTime: string;
  appointmentType: string;
  columnId: ReceptionBoardQueueColumnId;
  operationalStatus: ReceptionBoardOperationalStatus;
  clinician: string;
  room: string | null;
  /** One-click advance action when available. */
  nextFlowAction: ReceptionBoardFlowActionKind | null;
  hrefs: ReceptionBoardAppointmentCard["hrefs"];
};

export type ReceptionBoardExtendedAlertKind =
  | ReceptionOsActionAlert["kind"]
  | "missing_consent"
  | "missing_pre_op_checklist"
  | "missing_imaging"
  | "incomplete_consultation"
  | "surgery_readiness_incomplete"
  | "missing_treatment_plan"
  | "unconfirmed_surgery"
  | "staff_not_assigned"
  | "missing_medical_clearance";

export type ReceptionBoardActionAlert = {
  id: string;
  kind: ReceptionBoardExtendedAlertKind;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical" | "blocked";
  href: string | null;
  priorityScore: number;
};

export type ReceptionBoardQuickActionId =
  | "check_in"
  | "collect_payment"
  | "book_consultation"
  | "book_surgery"
  | "book_follow_up"
  | "upload_documents"
  | "upload_images"
  | "generate_invoice"
  | "reschedule"
  | "cancel"
  | "view_patient"
  | "open_calendar"
  | "open_procedure_day";

export type ReceptionBoardQuickAction = {
  id: ReceptionBoardQuickActionId;
  label: string;
  href: string;
  description: string;
};

export type ReceptionBoardTomorrowSurgery = {
  bookingId: string;
  patientLabel: string;
  procedureType: string;
  surgeon: string | null;
  assignedStaff: string | null;
  room: string | null;
  surgeryDate: string;
  surgeryTime: string;
  readinessPercent: number;
  readinessTone: "green" | "yellow" | "red";
  depositPaid: boolean;
  consentSigned: boolean;
  photosCompleted: boolean;
  preOpChecklistComplete: boolean;
  medicalClearance: boolean;
  missingItems: string[];
  hrefs: {
    case: string | null;
    patient: string | null;
    calendar: string;
  };
};

export type ReceptionBoardIntelligenceMetrics = {
  todayConsultations: number;
  todaySurgeries: number;
  revenueBookedToday: number;
  outstandingPayments: number;
  conversionRateToday: number | null;
  doctorUtilizationPercent: number | null;
  staffUtilizationPercent: number | null;
  averageConsultationCloseRate: number | null;
  upcomingFollowUps: number;
  unreadPatientTasks: number;
};

export type ReceptionBoardLiveEventKind =
  | "booking_created"
  | "payment_received"
  | "patient_checked_in"
  | "surgery_completed"
  | "consultation_submitted"
  | "voice_note_approved"
  | "imaging_uploaded"
  | "staff_assignment_changed"
  | "communication"
  | "other";

export type ReceptionBoardLiveEvent = {
  id: string;
  kind: ReceptionBoardLiveEventKind;
  title: string;
  detail: string | null;
  occurredAt: string;
  href: string | null;
};

export type ReceptionBoardCommandCenterPayload = {
  tenantId: string;
  tenantName: string;
  loadedAt: string;
  operationalDay: {
    calendarTimezone: string;
    todayYmd: string;
    localStartIso: string;
    localEndIso: string;
  };
  appointments: ReceptionBoardAppointmentCard[];
  queue: Record<ReceptionBoardQueueColumnId, ReceptionBoardQueueItem[]>;
  actionAlerts: ReceptionBoardActionAlert[];
  quickActions: ReceptionBoardQuickAction[];
  tomorrowSurgeries: ReceptionBoardTomorrowSurgery[];
  intelligence: ReceptionBoardIntelligenceMetrics;
  liveEvents: ReceptionBoardLiveEvent[];
  /** Raw reception cards for flow mutations (server-trusted shape). */
  receptionCards: ReceptionBoardCard[];
  /** Surgery readiness source rows for tomorrow panel (server only; stripped on client refresh). */
  _surgerySource?: SurgeryReadinessBoardCard[];
};