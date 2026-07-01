/**
 * Reception Board Command Center — pure orchestration helpers.
 * Composes existing FI OS primitives without duplicating business rules.
 */

import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import type { ReceptionBoardFlowActionKind } from "@/src/lib/fiOs/receptionBoardFlowPolicy";
import {
  compareReceptionOsSeverity,
  type ReceptionOsSeverity,
} from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { SurgeryReadinessBoardCard } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import { SURGERY_READINESS_ISSUE_LABEL } from "@/src/lib/surgery/surgeryReadinessBoardModel";
import type {
  ReceptionBoardActionAlert,
  ReceptionBoardAppointmentCard,
  ReceptionBoardExtendedAlertKind,
  ReceptionBoardIntelligenceMetrics,
  ReceptionBoardLiveEvent,
  ReceptionBoardLiveEventKind,
  ReceptionBoardOperationalStatus,
  ReceptionBoardQueueColumnId,
  ReceptionBoardQueueItem,
  ReceptionBoardQuickAction,
  ReceptionBoardTomorrowSurgery,
} from "./receptionBoardTypes";
import {
  RECEPTION_BOARD_QUEUE_COLUMN_IDS,
  RECEPTION_BOARD_QUEUE_COLUMN_LABELS,
} from "./receptionBoardTypes";

export { RECEPTION_BOARD_QUEUE_COLUMN_LABELS };

function bookingStatusNorm(status: string): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function isOverdueExpected(card: ReceptionBoardCard, nowMs: number): boolean {
  if (card.receptionColumn !== "expected") return false;
  const start = Date.parse(card.startAt);
  return Number.isFinite(start) && start <= nowMs;
}

/** Map tenant booking row + reception column to Sprint 2 operational status. */
export function mapCardToOperationalStatus(
  card: ReceptionBoardCard,
  nowMs = Date.now()
): ReceptionBoardOperationalStatus {
  const st = bookingStatusNorm(card.bookingStatus);
  if (st === "cancelled") return "cancelled";
  if (st === "completed") return "completed";
  if (st === "no_show") return "cancelled";

  switch (card.receptionColumn) {
    case "expected":
      if (isOverdueExpected(card, nowMs)) return "waiting";
      return st === "confirmed" ? "confirmed" : "scheduled";
    case "arrived":
      return "checked_in";
    case "in_consultation":
      return "in_consultation";
    case "in_treatment":
      return "in_procedure";
    case "complete":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "no_show":
      return "cancelled";
  }
}

/** Bucket operational status into the live arrival queue column. */
export function mapOperationalStatusToQueueColumn(
  status: ReceptionBoardOperationalStatus
): ReceptionBoardQueueColumnId | null {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "confirmed":
      return "arrived";
    case "arrived":
      return "arrived";
    case "checked_in":
      return "checked_in";
    case "waiting":
      return "waiting";
    case "in_consultation":
      return "in_consultation";
    case "in_procedure":
      return "procedure_in_progress";
    case "completed":
      return "completed";
    case "rescheduled":
      return "scheduled";
    case "cancelled":
      return null;
  }
}

/** Suggested one-click flow action to advance patient toward the next queue column. */
export function nextFlowActionForQueueColumn(
  columnId: ReceptionBoardQueueColumnId
): ReceptionBoardFlowActionKind | null {
  switch (columnId) {
    case "scheduled":
    case "arrived":
    case "waiting":
      return "mark_arrived";
    case "checked_in":
      return "start_consultation";
    case "in_consultation":
      return "start_treatment";
    case "procedure_in_progress":
      return "complete";
    case "completed":
    case "follow_up_booked":
      return null;
  }
}

export function appointmentDurationMinutes(startAt: string, endAt: string): number | null {
  const s = Date.parse(startAt);
  const e = Date.parse(endAt);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.round((e - s) / 60_000);
}

export function formatLocalTime(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function readinessToneFromPercent(
  percent: number
): ReceptionBoardTomorrowSurgery["readinessTone"] {
  if (percent > 90) return "green";
  if (percent >= 70) return "yellow";
  return "red";
}

export function readinessToneClass(tone: ReceptionBoardTomorrowSurgery["readinessTone"]): string {
  switch (tone) {
    case "green":
      return "text-emerald-400";
    case "yellow":
      return "text-amber-400";
    case "red":
      return "text-rose-400";
  }
}

export function buildAppointmentCard(
  card: ReceptionBoardCard,
  input: {
    base: string;
    tz: string;
    caseId: string | null;
    paymentStatus?: ReceptionBoardAppointmentCard["paymentStatus"];
    journeyState?: string | null;
    journeyStateLabel?: string | null;
    nowMs?: number;
  }
): ReceptionBoardAppointmentCard {
  const status = mapCardToOperationalStatus(card, input.nowMs);
  const st = bookingStatusNorm(card.bookingStatus);
  const paymentStatus = input.paymentStatus ?? "unknown";
  const paymentLabels: Record<ReceptionBoardAppointmentCard["paymentStatus"], string> = {
    paid: "Paid",
    due: "Payment due",
    overdue: "Overdue",
    not_required: "Not required",
    unknown: "—",
  };

  return {
    id: card.id,
    patientName: card.displayName,
    appointmentTime: formatLocalTime(card.startAt, input.tz),
    appointmentType: card.typeLabel,
    clinician: card.providerLabel,
    status,
    statusLabel: card.statusLabel,
    durationMinutes: appointmentDurationMinutes(card.startAt, card.endAt),
    room: card.roomLabel,
    paymentStatus,
    paymentStatusLabel: paymentLabels[paymentStatus],
    confirmationStatus:
      st === "cancelled" ? "cancelled" : st === "confirmed" ? "confirmed" : "unconfirmed",
    journeyState: input.journeyState ?? null,
    journeyStateLabel: input.journeyStateLabel ?? null,
    sortKey: card.startAt,
    hrefs: {
      patient: card.patientId ? `${input.base}/patients/${card.patientId}` : null,
      case: input.caseId ? `${input.base}/cases/${input.caseId}` : null,
      lead: card.leadId ? `${input.base}/crm/leads/${card.leadId}` : null,
      appointment: `${input.base}/appointments?bookingId=${card.id}`,
      calendar: `${input.base}/calendar?bookingId=${card.id}`,
    },
  };
}

export function sortAppointmentsChronologically(
  cards: readonly ReceptionBoardAppointmentCard[]
): ReceptionBoardAppointmentCard[] {
  return cards.slice().sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function buildQueueBoard(
  cards: readonly ReceptionBoardCard[],
  input: {
    base: string;
    tz: string;
    caseByBooking: ReadonlyMap<string, string>;
    nowMs?: number;
  }
): Record<ReceptionBoardQueueColumnId, ReceptionBoardQueueItem[]> {
  const empty = Object.fromEntries(
    RECEPTION_BOARD_QUEUE_COLUMN_IDS.map((id) => [id, [] as ReceptionBoardQueueItem[]])
  ) as Record<ReceptionBoardQueueColumnId, ReceptionBoardQueueItem[]>;

  for (const card of cards) {
    const status = mapCardToOperationalStatus(card, input.nowMs);
    const columnId = mapOperationalStatusToQueueColumn(status);
    if (!columnId) continue;

    empty[columnId].push({
      bookingId: card.id,
      patientName: card.displayName,
      appointmentTime: formatLocalTime(card.startAt, input.tz),
      appointmentType: card.typeLabel,
      columnId,
      operationalStatus: status,
      clinician: card.providerLabel,
      room: card.roomLabel,
      nextFlowAction: nextFlowActionForQueueColumn(columnId),
      hrefs: {
        patient: card.patientId ? `${input.base}/patients/${card.patientId}` : null,
        case: input.caseByBooking.get(card.id)
          ? `${input.base}/cases/${input.caseByBooking.get(card.id)}`
          : null,
        lead: card.leadId ? `${input.base}/crm/leads/${card.leadId}` : null,
        appointment: `${input.base}/appointments?bookingId=${card.id}`,
        calendar: `${input.base}/calendar?bookingId=${card.id}`,
      },
    });
  }

  for (const col of RECEPTION_BOARD_QUEUE_COLUMN_IDS) {
    empty[col].sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  }
  return empty;
}

const EXTENDED_ALERT_PRIORITY: Partial<Record<ReceptionBoardExtendedAlertKind, number>> = {
  surgery_risk: 98,
  missing_deposit: 95,
  missing_medical_clearance: 94,
  surgery_readiness_incomplete: 92,
  missing_consent: 90,
  unconfirmed_surgery: 88,
  staff_not_assigned: 86,
  missing_pre_op_checklist: 84,
  missing_imaging: 82,
  missing_treatment_plan: 80,
  incomplete_consultation: 78,
  missing_forms: 76,
  no_follow_up_after_consultation: 70,
};

function severityToPriority(severity: ReceptionOsSeverity): number {
  switch (severity) {
    case "blocked":
      return 100;
    case "critical":
      return 90;
    case "warning":
      return 70;
    case "info":
      return 40;
  }
}

export function mapOsAlertToBoardAlert(alert: ReceptionOsActionAlert): ReceptionBoardActionAlert {
  const priorityScore =
    EXTENDED_ALERT_PRIORITY[alert.kind] ?? severityToPriority(alert.severity) ?? 50;
  return {
    id: alert.id,
    kind: alert.kind,
    title: alert.title,
    detail: alert.detail,
    severity: alert.severity,
    href: alert.href,
    priorityScore,
  };
}

export function buildExtendedAlertsFromSurgeryCards(
  cards: readonly SurgeryReadinessBoardCard[],
  base: string,
  tomorrowYmd: string
): ReceptionBoardActionAlert[] {
  const alerts: ReceptionBoardActionAlert[] = [];

  for (const card of cards) {
    if (card.surgeryLocalYmd !== tomorrowYmd) continue;

    for (const issue of card.issues) {
      const kindMap: Partial<Record<string, ReceptionBoardExtendedAlertKind>> = {
        missing_consent_proxy: "missing_consent",
        surgery_deposit_pending: "missing_deposit",
        no_payment_tracking: "missing_deposit",
        missing_surgery_plan: "missing_treatment_plan",
        booking_unconfirmed: "unconfirmed_surgery",
        missing_pathology: "missing_medical_clearance",
        abnormal_pathology: "missing_medical_clearance",
      };
      const kind = kindMap[issue.kind] ?? "surgery_readiness_incomplete";
      const severity: ReceptionBoardActionAlert["severity"] =
        issue.severity === "high_risk" ? "critical" : issue.severity === "warning" ? "warning" : "info";

      alerts.push({
        id: `surgery-issue-${card.bookingId}-${issue.kind}`,
        kind,
        title: SURGERY_READINESS_ISSUE_LABEL[issue.kind],
        detail: `${card.patientLabel} · surgery ${card.surgeryLocalYmd}`,
        severity,
        href: card.hrefs.case ?? card.hrefs.patient ?? card.hrefs.calendar,
        priorityScore: EXTENDED_ALERT_PRIORITY[kind] ?? 75,
      });
    }

    if (!card.assigneeLabel?.trim()) {
      alerts.push({
        id: `surgery-staff-${card.bookingId}`,
        kind: "staff_not_assigned",
        title: "Staff not assigned to surgery",
        detail: `${card.patientLabel} · ${card.surgeryLocalYmd}`,
        severity: "warning",
        href: card.hrefs.calendar,
        priorityScore: EXTENDED_ALERT_PRIORITY.staff_not_assigned ?? 86,
      });
    }
  }

  return alerts;
}

export function sortActionAlerts(
  alerts: readonly ReceptionBoardActionAlert[]
): ReceptionBoardActionAlert[] {
  return alerts
    .slice()
    .sort((a, b) => {
      const sd = compareReceptionOsSeverity(a.severity, b.severity);
      if (sd !== 0) return sd;
      return b.priorityScore - a.priorityScore;
    });
}

export function buildQuickActions(base: string): ReceptionBoardQuickAction[] {
  return [
    {
      id: "check_in",
      label: "Check in patient",
      href: `${base}/reception-board#queue`,
      description: "Move a patient into the live arrival queue.",
    },
    {
      id: "collect_payment",
      label: "Collect payment",
      href: `${base}/financial/dashboard`,
      description: "Record deposits and balances.",
    },
    {
      id: "book_consultation",
      label: "Book consultation",
      href: `${base}/calendar`,
      description: "Open CalendarOS to schedule a consult.",
    },
    {
      id: "book_surgery",
      label: "Book surgery",
      href: `${base}/surgery-booking`,
      description: "Launch the guided surgery booking wizard.",
    },
    {
      id: "book_follow_up",
      label: "Book follow up",
      href: `${base}/calendar`,
      description: "Schedule a follow-up visit.",
    },
    {
      id: "upload_documents",
      label: "Upload documents",
      href: `${base}/patients`,
      description: "Open PatientOS document workflows.",
    },
    {
      id: "upload_images",
      label: "Upload images",
      href: `${base}/patients`,
      description: "Open ImagingOS from a patient chart.",
    },
    {
      id: "generate_invoice",
      label: "Generate invoice",
      href: `${base}/financial/dashboard`,
      description: "Create or send an invoice.",
    },
    {
      id: "reschedule",
      label: "Reschedule",
      href: `${base}/calendar`,
      description: "Move an appointment in CalendarOS.",
    },
    {
      id: "cancel",
      label: "Cancel appointment",
      href: `${base}/calendar`,
      description: "Cancel from the booking detail.",
    },
    {
      id: "view_patient",
      label: "View patient profile",
      href: `${base}/patients`,
      description: "Open PatientOS.",
    },
    {
      id: "open_calendar",
      label: "Open calendar",
      href: `${base}/calendar`,
      description: "Full clinic schedule.",
    },
  ];
}

function hasIssueKind(
  card: SurgeryReadinessBoardCard,
  kind: SurgeryReadinessBoardCard["issues"][number]["kind"]
): boolean {
  return card.issues.some((i) => i.kind === kind);
}

function preOpChecklistFromMetadata(card: SurgeryReadinessBoardCard): boolean {
  const meta = card as SurgeryReadinessBoardCard & { metadata?: Record<string, unknown> };
  const checklist = meta.metadata?.pre_op_checklist;
  if (!Array.isArray(checklist)) return card.readinessPercent != null && card.readinessPercent >= 80;
  return checklist.every((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as { complete?: boolean }).complete === true;
  });
}

export function mapTomorrowSurgeryCard(
  card: SurgeryReadinessBoardCard,
  tomorrowYmd: string
): ReceptionBoardTomorrowSurgery | null {
  if (card.surgeryLocalYmd !== tomorrowYmd) return null;

  const depositPaid = !hasIssueKind(card, "surgery_deposit_pending") && !hasIssueKind(card, "no_payment_tracking");
  const consentSigned = !hasIssueKind(card, "missing_consent_proxy");
  const medicalClearance =
    !hasIssueKind(card, "missing_pathology") && !hasIssueKind(card, "abnormal_pathology");
  const preOpChecklistComplete = preOpChecklistFromMetadata(card);
  const photosCompleted = card.readinessPercent != null ? card.readinessPercent >= 50 : true;

  const missingItems: string[] = [];
  if (!depositPaid) missingItems.push("Deposit payment");
  if (!consentSigned) missingItems.push("Consent signature");
  if (!preOpChecklistComplete) missingItems.push("Pre-op checklist");
  if (!photosCompleted) missingItems.push("Clinical photos");
  if (!medicalClearance) missingItems.push("Medical clearance");
  if (!card.assigneeLabel?.trim()) missingItems.push("Surgeon / staff assignment");
  for (const issue of card.issues) {
    const label = SURGERY_READINESS_ISSUE_LABEL[issue.kind];
    if (!missingItems.includes(label)) missingItems.push(label);
  }

  const readinessPercent = card.readinessPercent ?? (missingItems.length === 0 ? 100 : Math.max(0, 100 - missingItems.length * 12));

  return {
    bookingId: card.bookingId,
    patientLabel: card.patientLabel,
    procedureType: card.bookingTypeLabel,
    surgeon: card.assigneeLabel,
    assignedStaff: card.clinicalStaffing?.assignedCounts
      ? `${Object.values(card.clinicalStaffing.assignedCounts).reduce((a, b) => a + b, 0)} assigned`
      : card.assigneeLabel,
    room: null,
    surgeryDate: card.surgeryLocalYmd,
    surgeryTime: card.bookingTimeLabel,
    readinessPercent,
    readinessTone: readinessToneFromPercent(readinessPercent),
    depositPaid,
    consentSigned,
    photosCompleted,
    preOpChecklistComplete,
    medicalClearance,
    missingItems: missingItems.slice(0, 6),
    hrefs: card.hrefs,
  };
}

export function buildIntelligenceMetrics(input: {
  cards: readonly ReceptionBoardCard[];
  revenueBookedToday?: number;
  outstandingPayments?: number;
  conversionRateToday?: number | null;
  upcomingFollowUps?: number;
  unreadPatientTasks?: number;
}): ReceptionBoardIntelligenceMetrics {
  const consultTypes = (t: string) => {
    const x = t.toLowerCase();
    return x.includes("consult") || x.includes("review") || x.includes("follow");
  };
  const surgeryTypes = (t: string) => {
    const x = t.toLowerCase();
    return x.includes("surgery") || x.includes("procedure") || x.includes("prp") || x.includes("exosome");
  };

  const todayConsultations = input.cards.filter((c) => consultTypes(c.bookingType)).length;
  const todaySurgeries = input.cards.filter((c) => surgeryTypes(c.bookingType)).length;
  const inClinical = input.cards.filter(
    (c) => c.receptionColumn === "in_consultation" || c.receptionColumn === "in_treatment"
  ).length;
  const activeStaffSlots = input.cards.filter((c) => c.providerLabel && c.providerLabel !== "—").length;

  const doctorUtilizationPercent =
    todayConsultations > 0 ? Math.min(100, Math.round((inClinical / todayConsultations) * 100)) : null;
  const staffUtilizationPercent =
    input.cards.length > 0
      ? Math.min(100, Math.round((activeStaffSlots / input.cards.length) * 100))
      : null;

  const completedConsults = input.cards.filter(
    (c) => consultTypes(c.bookingType) && c.receptionColumn === "complete"
  ).length;
  const averageConsultationCloseRate =
    todayConsultations > 0 ? Math.round((completedConsults / todayConsultations) * 100) / 100 : null;

  return {
    todayConsultations,
    todaySurgeries,
    revenueBookedToday: input.revenueBookedToday ?? 0,
    outstandingPayments: input.outstandingPayments ?? 0,
    conversionRateToday: input.conversionRateToday ?? null,
    doctorUtilizationPercent,
    staffUtilizationPercent,
    averageConsultationCloseRate,
    upcomingFollowUps: input.upcomingFollowUps ?? 0,
    unreadPatientTasks: input.unreadPatientTasks ?? 0,
  };
}

export function buildLiveActivityFeed(input: {
  cards: readonly ReceptionBoardCard[];
  communicationEvents: Array<{
    id: string;
    kind: string;
    subject: string | null;
    preview: string | null;
    patientOrLeadLabel: string;
    contactAt: string;
    hrefs: { patient: string | null; case: string | null; lead: string | null };
  }>;
  base: string;
  loadedAt: string;
}): ReceptionBoardLiveEvent[] {
  const events: ReceptionBoardLiveEvent[] = [];

  for (const card of input.cards) {
    const status = mapCardToOperationalStatus(card);
    if (status === "checked_in" || status === "arrived") {
      events.push({
        id: `checkin-${card.id}`,
        kind: "patient_checked_in",
        title: `${card.displayName} checked in`,
        detail: `${card.typeLabel} · ${formatLocalTime(card.startAt, "UTC")}`,
        occurredAt: card.startAt,
        href: `${input.base}/appointments?bookingId=${card.id}`,
      });
    }
    if (status === "completed") {
      const isSurgery = card.bookingType.toLowerCase().includes("surgery");
      events.push({
        id: `complete-${card.id}`,
        kind: isSurgery ? "surgery_completed" : "consultation_submitted",
        title: isSurgery ? `Surgery completed — ${card.displayName}` : `Consultation completed — ${card.displayName}`,
        detail: card.typeLabel,
        occurredAt: card.endAt,
        href: card.patientId ? `${input.base}/patients/${card.patientId}` : null,
      });
    }
  }

  for (const comm of input.communicationEvents) {
    const kind: ReceptionBoardLiveEventKind =
      comm.kind === "consultation_note" ? "consultation_submitted" : "communication";
    events.push({
      id: `comm-${comm.id}`,
      kind,
      title: comm.subject?.trim() || comm.patientOrLeadLabel,
      detail: comm.preview,
      occurredAt: comm.contactAt,
      href: comm.hrefs.patient ?? comm.hrefs.lead ?? comm.hrefs.case,
    });
  }

  events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return events.slice(0, 40);
}

/** Assert tenant id on payload before client refresh applies data. */
export function assertReceptionBoardTenantScope(
  expectedTenantId: string,
  payloadTenantId: string
): void {
  const exp = expectedTenantId.trim();
  const got = payloadTenantId.trim();
  if (!exp || !got || exp !== got) {
    throw new Error("Reception board payload tenant mismatch.");
  }
}