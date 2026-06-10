/**
 * Tomorrow Board V1 — pure window, filtering, summaries, and action derivation (ClinicOS).
 */

import { bookingStartFallsOnOperationalWindow } from "@/src/lib/fiOs/receptionBoardModel";
import { computeOperationalLocalDayUtcWindow } from "@/src/lib/fiOs/tenantOperationalLocalDay";
import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  normalizeCalendarTimezone,
  zonedMidnightUtcMs,
  zonedNextDayUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CaseWorklistRow } from "@/src/lib/cases/casesIndexTypes";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { paymentRecordNeedsCollection } from "@/src/lib/payments/paymentRecordModel";
import {
  buildSurgeryReadinessIssues,
  calendarDaysUntilSurgery,
  escalateSurgeryReadinessIssues,
  hasConsultationConsentSignal,
  hasHighRiskSeverity,
  hasIssueKind,
  isActiveSurgeryBookingStatus,
  type ConsultationConsentInput,
  type SurgeryReadinessIssue,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";

/** Matches operational dashboard / reception “active” agenda rows. */
export const TOMORROW_AGENDA_BOOKING_STATUSES = ["scheduled", "confirmed", "arrived"] as const;
const AGENDA_SET = new Set<string>(TOMORROW_AGENDA_BOOKING_STATUSES);

export type TomorrowOperationalWindow = {
  calendarTimezone: string;
  /** Tenant-local operational “today” when the board is viewed. */
  todayYmd: string;
  /** Tenant-local calendar day for tomorrow’s clinic day. */
  tomorrowYmd: string;
  /** Half-open UTC range for tomorrow’s operational day (same semantics as reception board). */
  localStartIso: string;
  localEndIso: string;
};

/**
 * Tenant-local tomorrow clinic day as UTC half-open bounds `[localStartIso, localEndIso)`.
 */
export function computeTomorrowOperationalWindow(now: Date, calendarTimezone: string): TomorrowOperationalWindow {
  const tz = normalizeCalendarTimezone(calendarTimezone);
  const { todayYmd } = computeOperationalLocalDayUtcWindow(now, tz);
  const tomorrowYmd = addDaysToCalendarDate(todayYmd, 1, tz);
  const startMs = zonedMidnightUtcMs(tomorrowYmd, tz);
  const endMs = zonedNextDayUtcMs(tomorrowYmd, tz);
  const localStartIso = (startMs != null ? new Date(startMs) : new Date(now.getTime() + 86_400_000)).toISOString();
  const localEndIso = (endMs != null ? new Date(endMs) : new Date(now.getTime() + 2 * 86_400_000)).toISOString();
  return { calendarTimezone: tz, todayYmd, tomorrowYmd, localStartIso, localEndIso };
}

export function isTomorrowAgendaBooking(
  booking: Pick<FiBookingRow, "start_at" | "booking_status">,
  window: TomorrowOperationalWindow
): boolean {
  const st = String(booking.booking_status ?? "").trim().toLowerCase();
  if (!AGENDA_SET.has(st)) return false;
  return bookingStartFallsOnOperationalWindow(booking.start_at, window.localStartIso, window.localEndIso);
}

export type TomorrowSummaryCategory = "consultation" | "surgery" | "prp_treatment" | "follow_up" | "other";

export function tomorrowSummaryCategory(bookingType: string): TomorrowSummaryCategory {
  const t = bookingType.trim().toLowerCase();
  if (t === "consultation") return "consultation";
  if (t === "surgery") return "surgery";
  if (t === "prp" || t === "prf" || t === "mesotherapy" || t === "exosomes") return "prp_treatment";
  if (t === "follow_up" || t === "review") return "follow_up";
  return "other";
}

export type TomorrowSurgeryReadinessDerived = {
  bookingId: string;
  patientLabel: string;
  surgeryLocalYmd: string;
  bookingTimeKey: string;
  bookingStatus: string;
  caseId: string | null;
  issues: SurgeryReadinessIssue[];
  /** True when any issue has `high_risk` severity (includes abnormal pathology). */
  isHighRisk: boolean;
};

export type BuildTomorrowSurgeryReadinessInput = {
  window: TomorrowOperationalWindow;
  surgeryBookings: FiBookingRow[];
  worklistByCaseId: Map<string, CaseWorklistRow>;
  pathology: { withResult: Set<string>; abnormalTotalByPatient: Map<string, number> };
  consultationsByCaseId: Map<string, ConsultationConsentInput[]>;
  surgeryPayments: { byBookingId: Map<string, PaymentRecordRow>; byCaseId: Map<string, PaymentRecordRow> };
  resolvePatientIdForCaseRow: (row: CaseWorklistRow) => string | null;
  patientLabelForBooking: (b: FiBookingRow, work: CaseWorklistRow | null) => string;
};

export function buildTomorrowSurgeryReadinessRows(input: BuildTomorrowSurgeryReadinessInput): TomorrowSurgeryReadinessDerived[] {
  const { window, surgeryBookings, worklistByCaseId, pathology, consultationsByCaseId, surgeryPayments, resolvePatientIdForCaseRow, patientLabelForBooking } =
    input;
  const tz = window.calendarTimezone;
  const out: TomorrowSurgeryReadinessDerived[] = [];

  for (const b of surgeryBookings) {
    if (!isActiveSurgeryBookingStatus(b.booking_status)) continue;
    const caseId = b.case_id?.trim() || null;
    const work = caseId ? worklistByCaseId.get(caseId) ?? null : null;
    const patientIdForPathology = b.patient_id?.trim() || (work ? resolvePatientIdForCaseRow(work) : null);
    const hasPathology = patientIdForPathology ? pathology.withResult.has(patientIdForPathology) : false;
    const consultRows = caseId ? consultationsByCaseId.get(caseId) ?? [] : [];
    const hasConsent = hasConsultationConsentSignal(consultRows);
    const abnormalN = patientIdForPathology ? pathology.abnormalTotalByPatient.get(patientIdForPathology) ?? 0 : 0;
    const payByBooking = surgeryPayments.byBookingId.get(b.id) ?? null;
    const payByCase = caseId ? surgeryPayments.byCaseId.get(caseId) ?? null : null;
    const surgeryPaymentRow = payByBooking ?? payByCase;
    const daysUntil = calendarDaysUntilSurgery(tz, window.todayYmd, b.start_at);
    const rawIssues = buildSurgeryReadinessIssues({
      caseId,
      patientIdForPathology,
      hasPathologyResult: hasPathology,
      abnormalPathologyMarkerCount: abnormalN,
      hasConsentProxy: !caseId ? true : hasConsent,
      hasSurgeryPlanRow: Boolean(work?.surgeryPlan),
      surgeryPlanningComplete: work ? work.readinessSurgeryPlanningHealth === "complete" : false,
      bookingStatus: b.booking_status,
      surgeryPlanPlanningStatus: work?.surgeryPlan?.planning_status ?? null,
      surgeryPaymentRecord: surgeryPaymentRow,
      todayYmd: window.todayYmd,
    });
    const issues = escalateSurgeryReadinessIssues(rawIssues, daysUntil, b.booking_status);
    const surgeryLocalYmd = calendarDateStringFromInstant(new Date(b.start_at), tz);
    out.push({
      bookingId: b.id,
      patientLabel: patientLabelForBooking(b, work),
      surgeryLocalYmd,
      bookingTimeKey: b.start_at,
      bookingStatus: b.booking_status,
      caseId,
      issues,
      isHighRisk: hasHighRiskSeverity(issues),
    });
  }
  out.sort((a, b) => a.bookingTimeKey.localeCompare(b.bookingTimeKey) || a.patientLabel.localeCompare(b.patientLabel));
  return out;
}

export type TomorrowActionKind =
  | "call_unconfirmed"
  | "chase_pathology"
  | "chase_deposit"
  | "link_case"
  | "review_abnormal_bloods";

export type TomorrowActionItem = {
  kind: TomorrowActionKind;
  label: string;
  bookingId: string;
  patientLabel: string;
};

export type DeriveTomorrowActionsInput = {
  window: TomorrowOperationalWindow;
  /** All tomorrow agenda bookings (any type). */
  agendaBookings: FiBookingRow[];
  surgeryReadiness: TomorrowSurgeryReadinessDerived[];
  surgeryPayments: { byBookingId: Map<string, PaymentRecordRow>; byCaseId: Map<string, PaymentRecordRow> };
  /** Display label for action rows. */
  bookingLabel: (b: FiBookingRow) => string;
};

export function deriveTomorrowActionItems(input: DeriveTomorrowActionsInput): TomorrowActionItem[] {
  const { window, agendaBookings, surgeryReadiness, surgeryPayments, bookingLabel } = input;
  const actions: TomorrowActionItem[] = [];
  const seen = new Set<string>();

  function key(kind: TomorrowActionKind, bookingId: string): string {
    return `${kind}:${bookingId}`;
  }

  function pushAction(kind: TomorrowActionKind, label: string, bookingId: string, patientLabel: string): void {
    const k = key(kind, bookingId);
    if (seen.has(k)) return;
    seen.add(k);
    actions.push({ kind, label, bookingId, patientLabel });
  }

  for (const b of agendaBookings) {
    const st = b.booking_status.trim().toLowerCase();
    if (st === "scheduled") {
      const label = b.booking_type.trim().toLowerCase() === "surgery" ? "Call patient — surgery not confirmed" : "Call patient — appointment not confirmed";
      pushAction("call_unconfirmed", label, b.id, bookingLabel(b));
    }
  }

  for (const row of surgeryReadiness) {
    const patientLabel = row.patientLabel;
    if (hasIssueKind(row.issues, "missing_pathology")) {
      pushAction("chase_pathology", "Chase blood pathology", row.bookingId, patientLabel);
    }
    if (hasIssueKind(row.issues, "abnormal_pathology")) {
      pushAction("review_abnormal_bloods", "Review abnormal bloods", row.bookingId, patientLabel);
    }
    if (hasIssueKind(row.issues, "missing_case_link")) {
      pushAction("link_case", "Link SurgeryOS case to booking", row.bookingId, patientLabel);
    }
    const pay =
      surgeryPayments.byBookingId.get(row.bookingId) ?? (row.caseId ? surgeryPayments.byCaseId.get(row.caseId) ?? null : null);
    if (pay && hasIssueKind(row.issues, "surgery_deposit_pending") && paymentRecordNeedsCollection(pay, window.todayYmd)) {
      pushAction("chase_deposit", "Chase surgery deposit (manual record)", row.bookingId, patientLabel);
    }
  }

  return actions.sort((a, b) => {
    const rank = (k: TomorrowActionKind) =>
      k === "review_abnormal_bloods" ? 0 : k === "chase_pathology" ? 1 : k === "chase_deposit" ? 2 : k === "link_case" ? 3 : 4;
    const d = rank(a.kind) - rank(b.kind);
    if (d !== 0) return d;
    return a.patientLabel.localeCompare(b.patientLabel);
  });
}

export type TomorrowChecklistFlag =
  | "confirmation_incomplete"
  | "no_patient_lead_anchor"
  | "missing_contact"
  | "manual_payment_pending"
  | "consent_pending";

export type TomorrowChecklistItem = {
  bookingId: string;
  patientLabel: string;
  flags: TomorrowChecklistFlag[];
};

export type BuildTomorrowChecklistInput = {
  agendaBookings: FiBookingRow[];
  consultationsByCaseId: Map<string, ConsultationConsentInput[]>;
  paymentByBookingId: Map<string, PaymentRecordRow>;
  todayYmd: string;
  personContactByPersonId: Map<string, { hasEmail: boolean; hasPhone: boolean }>;
  bookingLabel: (b: FiBookingRow) => string;
};

export function buildTomorrowFrontDeskChecklist(input: BuildTomorrowChecklistInput): TomorrowChecklistItem[] {
  const { agendaBookings, consultationsByCaseId, paymentByBookingId, todayYmd, personContactByPersonId, bookingLabel } = input;
  const rows: TomorrowChecklistItem[] = [];

  for (const b of agendaBookings) {
    const flags: TomorrowChecklistFlag[] = [];
    if (b.booking_status.trim().toLowerCase() === "scheduled") flags.push("confirmation_incomplete");
    const hasAnchor = Boolean(
      b.patient_id?.trim() || b.lead_id?.trim() || b.person_id?.trim() || b.case_id?.trim()
    );
    if (!hasAnchor) flags.push("no_patient_lead_anchor");

    const pid = b.person_id?.trim();
    if (pid) {
      const c = personContactByPersonId.get(pid);
      if (c && !c.hasEmail && !c.hasPhone) flags.push("missing_contact");
    }

    const pay = paymentByBookingId.get(b.id);
    if (pay && paymentRecordNeedsCollection(pay, todayYmd)) flags.push("manual_payment_pending");

    const cid = b.case_id?.trim();
    if (cid) {
      const consults = consultationsByCaseId.get(cid) ?? [];
      if (consults.length && !hasConsultationConsentSignal(consults)) flags.push("consent_pending");
    }

    if (flags.length) {
      rows.push({
        bookingId: b.id,
        patientLabel: bookingLabel(b),
        flags,
      });
    }
  }
  return rows.sort((a, b) => a.patientLabel.localeCompare(b.patientLabel));
}

export type TomorrowDistinctPatientKey = string;

export function distinctTomorrowPatientKeys(bookings: FiBookingRow[]): Set<TomorrowDistinctPatientKey> {
  const s = new Set<TomorrowDistinctPatientKey>();
  for (const b of bookings) {
    if (b.patient_id?.trim()) s.add(`patient:${b.patient_id.trim()}`);
    else if (b.lead_id?.trim()) s.add(`lead:${b.lead_id.trim()}`);
    else if (b.person_id?.trim()) s.add(`person:${b.person_id.trim()}`);
    else if (b.case_id?.trim()) s.add(`case:${b.case_id.trim()}`);
    else s.add(`booking:${b.id}`);
  }
  return s;
}

export type TomorrowBoardSummary = {
  consultations: number;
  surgeries: number;
  prpTreatments: number;
  followUps: number;
  other: number;
  totalPatients: number;
  highRiskSurgeryItems: number;
  /** Manual surgery payment rows still expecting collection (tenant-local `todayYmd`). */
  paymentsDueSurgery: number;
};

export function summarizeTomorrowBoard(
  agendaBookings: FiBookingRow[],
  surgeryReadiness: TomorrowSurgeryReadinessDerived[],
  todayYmd: string,
  surgeryPayments: { byBookingId: Map<string, PaymentRecordRow>; byCaseId: Map<string, PaymentRecordRow> }
): TomorrowBoardSummary {
  let consultations = 0;
  let surgeries = 0;
  let prpTreatments = 0;
  let followUps = 0;
  let other = 0;
  for (const b of agendaBookings) {
    const cat = tomorrowSummaryCategory(b.booking_type);
    if (cat === "consultation") consultations += 1;
    else if (cat === "surgery") surgeries += 1;
    else if (cat === "prp_treatment") prpTreatments += 1;
    else if (cat === "follow_up") followUps += 1;
    else other += 1;
  }
  const totalPatients = distinctTomorrowPatientKeys(agendaBookings).size;
  let highRiskSurgeryItems = 0;
  let paymentsDueSurgery = 0;
  for (const row of surgeryReadiness) {
    if (row.isHighRisk) highRiskSurgeryItems += 1;
    const pay =
      surgeryPayments.byBookingId.get(row.bookingId) ?? (row.caseId ? surgeryPayments.byCaseId.get(row.caseId) ?? null : null);
    if (pay && hasIssueKind(row.issues, "surgery_deposit_pending") && paymentRecordNeedsCollection(pay, todayYmd)) {
      paymentsDueSurgery += 1;
    }
  }
  return {
    consultations,
    surgeries,
    prpTreatments,
    followUps,
    other,
    totalPatients,
    highRiskSurgeryItems,
    paymentsDueSurgery,
  };
}

export function reminderJobsNeedAttention(
  jobs: Array<{ status: string }> | null | undefined
): boolean {
  if (!jobs?.length) return false;
  return jobs.some((j) => {
    const st = String(j.status ?? "").trim().toLowerCase();
    return st === "pending" || st === "failed" || st === "processing";
  });
}
