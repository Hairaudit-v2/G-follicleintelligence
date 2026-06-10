/**
 * Pure model for FI OS Procedure Day Board V1 — today’s surgery bookings, readiness, procedure progress, and actions.
 */

import { addDaysToCalendarDate, calendarDateStringFromInstant, zonedMidnightUtcMs } from "@/src/lib/calendar/calendarTimezone";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { paymentRecordNeedsCollection } from "@/src/lib/payments/paymentRecordModel";
import {
  buildSurgeryReadinessIssues,
  escalateSurgeryReadinessIssues,
  hasConsultationConsentSignal,
  hasHighRiskSeverity,
  type ConsultationConsentInput,
  type SurgeryReadinessIssue,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";

export type ProcedureDayBoardWindow = {
  calendarTimezone: string;
  todayYmd: string;
  /** Half-open UTC range `[rangeStartIso, rangeEndIso)` covering the tenant-local calendar day. */
  rangeStartIso: string;
  rangeEndIso: string;
};

export function computeProcedureDayBoardWindow(now: Date, calendarTimezone: string): ProcedureDayBoardWindow {
  const tz = calendarTimezone.trim();
  const todayYmd = calendarDateStringFromInstant(now, tz);
  const nextYmd = addDaysToCalendarDate(todayYmd, 1, tz);
  const startMs = zonedMidnightUtcMs(todayYmd, tz);
  const endMs = zonedMidnightUtcMs(nextYmd, tz);
  const rangeStartIso = (startMs != null ? new Date(startMs) : now).toISOString();
  const rangeEndIso = (endMs != null ? new Date(endMs) : new Date(now.getTime() + 86_400_000)).toISOString();
  return { calendarTimezone: tz, todayYmd, rangeStartIso, rangeEndIso };
}

export function isBookingStartOnTenantLocalDay(startAtIso: string, tz: string, ymd: string): boolean {
  return calendarDateStringFromInstant(new Date(startAtIso), tz) === ymd.trim();
}

/** Buckets for aggregate procedure progress (fi_case_procedures.procedure_status). */
export type ProcedureProgressBucket = "scheduled" | "in_progress" | "completed" | "cancelled";

export function procedureProgressBucket(procedureStatus: string | null | undefined): ProcedureProgressBucket | null {
  if (!procedureStatus?.trim()) return null;
  const s = procedureStatus.trim().toLowerCase();
  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "aborted") return "cancelled";
  if (s === "in_progress" || s === "paused" || s === "checked_in") return "in_progress";
  if (s === "scheduled") return "scheduled";
  return "scheduled";
}

export type SurgeryDayPipelinePhase = "completed" | "in_progress" | "ready" | "scheduled";

/**
 * Live surgery row phase for summary tiles: completed / in progress / ready / scheduled.
 * Booking `completed` wins; then procedure status; then worklist readiness bucket.
 */
export function deriveSurgeryDayPipelinePhase(input: {
  bookingStatus: string;
  procedureStatus: string | null;
  readinessBucket: "ready" | "in_progress" | "needs_attention" | null;
}): SurgeryDayPipelinePhase {
  const bst = input.bookingStatus.trim().toLowerCase();
  if (bst === "completed") return "completed";
  const ps = input.procedureStatus?.trim().toLowerCase() ?? "";
  if (ps === "completed") return "completed";
  if (ps === "in_progress" || ps === "paused" || ps === "checked_in" || bst === "arrived") return "in_progress";
  if (input.readinessBucket === "ready") return "ready";
  return "scheduled";
}

export type ProcedureDayActionKind =
  | "link_missing_case"
  | "confirm_patient_arrived"
  | "assign_surgeon_team"
  | "complete_procedure_day_record"
  | "review_abnormal_pathology"
  | "assign_room"
  | "surgery_deposit_pending";

export type ProcedureDayActionItem = {
  kind: ProcedureDayActionKind;
  label: string;
  bookingId: string;
  caseId: string | null;
  patientLabel: string;
  href: string;
};

export type ProcedureDayActionInput = {
  tenantId: string;
  bookingId: string;
  caseId: string | null;
  patientLabel: string;
  bookingStatus: string;
  abnormalPathologyCount: number;
  hasBookingAssignee: boolean;
  hasProcedureSurgeon: boolean;
  roomRequired: boolean;
  hasRoom: boolean;
  procedureRowExists: boolean;
  procedureStatus: string | null;
  surgeryPaymentRecord: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid"> | null;
  todayYmd: string;
};

export function buildProcedureDayActionItems(input: ProcedureDayActionInput): ProcedureDayActionItem[] {
  const tid = input.tenantId.trim();
  const base = `/fi-admin/${encodeURIComponent(tid)}`;
  const appt = `${base}/appointments/${encodeURIComponent(input.bookingId)}`;
  const actions: ProcedureDayActionItem[] = [];

  if (!input.caseId?.trim()) {
    actions.push({
      kind: "link_missing_case",
      label: "Link a SurgeryOS case to this booking",
      bookingId: input.bookingId,
      caseId: null,
      patientLabel: input.patientLabel,
      href: appt,
    });
    return actions;
  }

  const cid = input.caseId.trim();
  const caseHref = `${base}/cases/${encodeURIComponent(cid)}`;

  if (input.abnormalPathologyCount > 0) {
    actions.push({
      kind: "review_abnormal_pathology",
      label: "Review abnormal pathology markers before start",
      bookingId: input.bookingId,
      caseId: cid,
      patientLabel: input.patientLabel,
      href: caseHref,
    });
  }

  const bst = input.bookingStatus.trim().toLowerCase();
  if (bst === "scheduled" || bst === "confirmed") {
    actions.push({
      kind: "confirm_patient_arrived",
      label: "Confirm patient arrived (move booking to arrived when appropriate)",
      bookingId: input.bookingId,
      caseId: cid,
      patientLabel: input.patientLabel,
      href: appt,
    });
  }

  if (!input.hasBookingAssignee && !input.hasProcedureSurgeon) {
    actions.push({
      kind: "assign_surgeon_team",
      label: "Assign surgeon / calendar team to this case",
      bookingId: input.bookingId,
      caseId: cid,
      patientLabel: input.patientLabel,
      href: appt,
    });
  }

  if (input.roomRequired && !input.hasRoom) {
    actions.push({
      kind: "assign_room",
      label: "Assign an operating room (required for this booking)",
      bookingId: input.bookingId,
      caseId: cid,
      patientLabel: input.patientLabel,
      href: appt,
    });
  }

  if (input.surgeryPaymentRecord && paymentRecordNeedsCollection(input.surgeryPaymentRecord, input.todayYmd)) {
    actions.push({
      kind: "surgery_deposit_pending",
      label: "Surgery deposit still expected (manual payment record)",
      bookingId: input.bookingId,
      caseId: cid,
      patientLabel: input.patientLabel,
      href: caseHref,
    });
  }

  const ps = input.procedureStatus?.trim().toLowerCase() ?? "";
  if (input.procedureRowExists && ps !== "completed" && ps !== "cancelled" && ps !== "aborted" && bst !== "completed") {
    actions.push({
      kind: "complete_procedure_day_record",
      label: "Complete procedure day record when the case finishes",
      bookingId: input.bookingId,
      caseId: cid,
      patientLabel: input.patientLabel,
      href: caseHref,
    });
  }

  return actions;
}

export type PreOpChecklistFlags = {
  caseLinked: boolean;
  consentProxy: boolean;
  pathologyReviewed: boolean;
  depositOkOrUntracked: boolean;
  procedurePlanComplete: boolean;
  surgeonAssigned: boolean;
  roomOk: boolean;
};

export function buildPreOpChecklistFlags(input: {
  caseId: string | null;
  consultRows: ConsultationConsentInput[];
  hasPathologyResult: boolean;
  surgeryPaymentRecord: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid"> | null;
  todayYmd: string;
  hasSurgeryPlanRow: boolean;
  surgeryPlanningComplete: boolean;
  hasBookingAssignee: boolean;
  hasProcedureSurgeon: boolean;
  roomRequired: boolean;
  hasRoom: boolean;
}): PreOpChecklistFlags {
  const caseLinked = Boolean(input.caseId?.trim());
  const consentProxy = !caseLinked ? true : hasConsultationConsentSignal(input.consultRows);
  const pathologyReviewed = !caseLinked ? true : input.hasPathologyResult;
  const depositOkOrUntracked =
    !input.surgeryPaymentRecord || !paymentRecordNeedsCollection(input.surgeryPaymentRecord, input.todayYmd);
  const procedurePlanComplete = !caseLinked ? false : input.hasSurgeryPlanRow && input.surgeryPlanningComplete;
  const surgeonAssigned = input.hasBookingAssignee || input.hasProcedureSurgeon;
  const roomOk = !input.roomRequired || input.hasRoom;
  return {
    caseLinked,
    consentProxy,
    pathologyReviewed,
    depositOkOrUntracked,
    procedurePlanComplete,
    surgeonAssigned,
    roomOk,
  };
}

export function buildTodayProcedureReadinessIssues(input: {
  caseId: string | null;
  patientIdForPathology: string | null;
  hasPathologyResult: boolean;
  abnormalPathologyMarkerCount: number;
  hasConsentProxy: boolean;
  hasSurgeryPlanRow: boolean;
  surgeryPlanningComplete: boolean;
  bookingStatus: string;
  surgeryPlanPlanningStatus: string | null;
  surgeryPaymentRecord: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid"> | null;
  todayYmd: string;
}): SurgeryReadinessIssue[] {
  const raw = buildSurgeryReadinessIssues({
    caseId: input.caseId,
    patientIdForPathology: input.patientIdForPathology,
    hasPathologyResult: input.hasPathologyResult,
    abnormalPathologyMarkerCount: input.abnormalPathologyMarkerCount,
    hasConsentProxy: input.hasConsentProxy,
    hasSurgeryPlanRow: input.hasSurgeryPlanRow,
    surgeryPlanningComplete: input.surgeryPlanningComplete,
    bookingStatus: input.bookingStatus,
    surgeryPlanPlanningStatus: input.surgeryPlanPlanningStatus,
    surgeryPaymentRecord: input.surgeryPaymentRecord,
    todayYmd: input.todayYmd,
  });
  return escalateSurgeryReadinessIssues(raw, 0, input.bookingStatus);
}

export type ProcedureDayBoardSummary = {
  surgeriesToday: number;
  ready: number;
  inProgress: number;
  completed: number;
  highRiskReadinessIssues: number;
  unassignedSurgeonOrTeam: number;
  missingRoom: number;
};

export type ProcedureDayProgressCounts = {
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
};

export function emptyProcedureDayProgressCounts(): ProcedureDayProgressCounts {
  return { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0 };
}

export function accumulateProcedureProgressCounts(
  acc: ProcedureDayProgressCounts,
  procedureStatus: string | null | undefined,
  rowExists: boolean
): void {
  if (!rowExists) return;
  const b = procedureProgressBucket(procedureStatus);
  if (b === "scheduled") acc.scheduled += 1;
  else if (b === "in_progress") acc.inProgress += 1;
  else if (b === "completed") acc.completed += 1;
  else if (b === "cancelled") acc.cancelled += 1;
}

export function summarizeProcedureDayBoard(
  phases: SurgeryDayPipelinePhase[],
  flags: { highRisk: boolean; unassignedTeam: boolean; missingRoom: boolean }[]
): ProcedureDayBoardSummary {
  let ready = 0;
  let inProgress = 0;
  let completed = 0;
  let highRiskReadinessIssues = 0;
  let unassignedSurgeonOrTeam = 0;
  let missingRoom = 0;
  for (const p of phases) {
    if (p === "ready") ready += 1;
    else if (p === "in_progress") inProgress += 1;
    else if (p === "completed") completed += 1;
  }
  for (const f of flags) {
    if (f.highRisk) highRiskReadinessIssues += 1;
    if (f.unassignedTeam) unassignedSurgeonOrTeam += 1;
    if (f.missingRoom) missingRoom += 1;
  }
  return {
    surgeriesToday: phases.length,
    ready,
    inProgress,
    completed,
    highRiskReadinessIssues,
    unassignedSurgeonOrTeam,
    missingRoom,
  };
}
