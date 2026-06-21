import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { buildCaseWorklistRows } from "@/src/lib/cases/casesIndexBuild";
import { loadCasesIndexExtensionBundle } from "@/src/lib/cases/casesIndexLoaders";
import type { CaseWorklistRow } from "@/src/lib/cases/casesIndexTypes";
import { loadCasesIndexRowsForIds } from "@/src/lib/cases/caseLoaders";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";
import { caseProcedureDayDetailHref } from "@/src/lib/cases/caseDetailNavConstants";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadFinancialSurgeryPipelineStatusByBookings } from "@/src/lib/financialOs/financialSurgeryPipelineStatus.server";
import type { FinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import { buildFinancialClearanceMapFromPipeline, type FinancialClearanceResult } from "@/src/lib/financialOs/financialClearance.server";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { loadPaymentRecordsForSurgeryBoard } from "@/src/lib/payments/paymentRecordLoaders.server";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { paymentRecordNeedsCollection, surgeryDepositBoardLabel, SURGERY_DEPOSIT_BOARD_COPY } from "@/src/lib/payments/paymentRecordModel";
import type { ClinicalStaffingSummaryDto } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";
import { loadClinicalStaffingSummariesForBookings } from "@/src/lib/workforce-os/workforceEventAssignmentBridge.server";
import {
  aggregateSurgeryReadinessKpis,
  buildSurgeryReadinessIssues,
  calendarDaysUntilSurgery,
  computeSurgeryReadinessBoardWindow,
  escalateSurgeryReadinessIssues,
  hasConsultationConsentSignal,
  isActiveSurgeryBookingStatus,
  isInstantInTenantInclusiveDayWindow,
  pickSurgeryReadinessPrimaryColumn,
  type ConsultationConsentInput,
  type SurgeryReadinessBoardColumnId,
  type SurgeryReadinessBoardWindow,
  type SurgeryReadinessIssue,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";

const BOARD_LIMIT = 240;

export type SurgeryReadinessBoardCard = {
  bookingId: string;
  caseId: string | null;
  patientLabel: string;
  surgeryLocalYmd: string;
  daysUntil: number;
  bookingTimeLabel: string;
  bookingStatus: string;
  bookingStatusLabel: string;
  bookingTypeLabel: string;
  assigneeLabel: string | null;
  caseStatus: string | null;
  caseStatusLabel: string | null;
  readinessPercent: number | null;
  readinessBucket: CaseWorklistRow["readinessBucket"] | null;
  /** Escalated issues (V1.1). */
  issues: SurgeryReadinessIssue[];
  primaryColumn: SurgeryReadinessBoardColumnId;
  /** Manual surgery deposit label for the card chrome. */
  surgeryDepositLabel: string;
  /** FinancialOS + revenue pipeline snapshot (Phase 1B). */
  financialPipeline: FinancialSurgeryPipelineStatus;
  /** FinancialOS Phase 4: unified clearance engine snapshot (advisory). */
  financialClearance: FinancialClearanceResult;
  hrefs: {
    case: string | null;
    patient: string | null;
    calendar: string;
    operationsCentre: string;
    appointments: string;
  };
  /** Raw ISO start for deep links / sorting */
  startAt: string;
  /** WorkforceOS Phase 2D — template-based staffing readiness for this surgery booking. */
  clinicalStaffing: ClinicalStaffingSummaryDto | null;
};

export type SurgeryReadinessBoardPayload = {
  window: SurgeryReadinessBoardWindow;
  columns: Record<SurgeryReadinessBoardColumnId, SurgeryReadinessBoardCard[]>;
  kpis: ReturnType<typeof aggregateSurgeryReadinessKpis>;
};

function formatLocalTimeFromIso(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function resolvePatientIdForCaseRow(row: CaseWorklistRow): string | null {
  return row.foundation_patient_id?.trim() || row.legacy_patient_id?.trim() || null;
}

export async function loadPatientLabelsForBookings(
  supabase: SupabaseClient,
  tenantId: string,
  bookings: FiBookingRow[]
): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const personIds = new Set<string>();
  const patientIds = new Set<string>();
  for (const b of bookings) {
    if (b.person_id?.trim()) personIds.add(b.person_id.trim());
    if (b.patient_id?.trim()) patientIds.add(b.patient_id.trim());
  }
  const out = new Map<string, string>();
  if (personIds.size) {
    const { data, error } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tid).in("id", Array.from(personIds));
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; metadata: unknown };
      const m = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
      out.set(`person:${String(r.id)}`, displayFromPersonMetadata(m).name);
    }
  }
  if (patientIds.size) {
    const { data, error } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tid)
      .in("id", Array.from(patientIds));
    if (error) throw new Error(error.message);
    const pToPerson = new Map<string, string>();
    for (const raw of data ?? []) {
      const r = raw as { id: string; person_id: string };
      pToPerson.set(String(r.id), String(r.person_id));
    }
    const extraPersonIds = uniqueStrings(Array.from(pToPerson.values()));
    if (extraPersonIds.length) {
      const { data: persons, error: pe } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tid).in("id", extraPersonIds);
      if (pe) throw new Error(pe.message);
      const labelByPerson = new Map<string, string>();
      for (const raw of persons ?? []) {
        const r = raw as { id: string; metadata: unknown };
        const m = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
        labelByPerson.set(String(r.id), displayFromPersonMetadata(m).name);
      }
      pToPerson.forEach((personId, pid) => {
        out.set(`patient:${pid}`, labelByPerson.get(personId) ?? "—");
      });
    }
  }
  return out;
}

function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id?.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

export async function loadStaffAndUserLabels(
  supabase: SupabaseClient,
  tenantId: string,
  bookings: FiBookingRow[]
): Promise<{ staffNames: Map<string, string>; userEmails: Map<string, string> }> {
  const tid = tenantId.trim();
  const staffIds = uniqueStrings(bookings.map((b) => b.assigned_staff_id));
  const userIds = uniqueStrings(bookings.map((b) => b.assigned_user_id));
  const staffNames = new Map<string, string>();
  const userEmails = new Map<string, string>();
  if (staffIds.length) {
    const { data, error } = await supabase.from("fi_staff").select("id, full_name, email").eq("tenant_id", tid).in("id", staffIds);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; full_name: string | null; email: string | null };
      staffNames.set(String(r.id), String(r.full_name ?? "").trim() || String(r.email ?? "").trim() || "Staff");
    }
  }
  if (userIds.length) {
    const { data, error } = await supabase.from("fi_users").select("id, email").eq("tenant_id", tid).in("id", userIds);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; email: string | null };
      userEmails.set(String(r.id), String(r.email ?? "").trim() || "User");
    }
  }
  return { staffNames, userEmails };
}

export async function loadPathologyPatientSets(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<{ withResult: Set<string>; abnormalTotalByPatient: Map<string, number> }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = uniqueStrings(patientIds);
  const withResult = new Set<string>();
  const abnormalTotalByPatient = new Map<string, number>();
  if (ids.length === 0) return { withResult, abnormalTotalByPatient };

  const { data: resRows, error } = await supabase.from("fi_pathology_results").select("id, patient_id").eq("tenant_id", tid).in("patient_id", ids);
  if (error) throw new Error(error.message);
  const resultIds: string[] = [];
  for (const raw of resRows ?? []) {
    const r = raw as { id: string; patient_id: string };
    withResult.add(String(r.patient_id));
    resultIds.push(String(r.id));
  }
  if (resultIds.length === 0) return { withResult, abnormalTotalByPatient };

  const { data: items, error: ie } = await supabase
    .from("fi_pathology_result_items")
    .select("result_id, flag")
    .eq("tenant_id", tid)
    .in("result_id", resultIds);
  if (ie) throw new Error(ie.message);

  const resultToPatient = new Map<string, string>();
  for (const raw of resRows ?? []) {
    const r = raw as { id: string; patient_id: string };
    resultToPatient.set(String(r.id), String(r.patient_id));
  }

  for (const raw of items ?? []) {
    const it = raw as { result_id: string; flag: string | null };
    const fl = String(it.flag ?? "").toLowerCase();
    if (fl !== "low" && fl !== "high" && fl !== "critical") continue;
    const pid = resultToPatient.get(String(it.result_id));
    if (!pid) continue;
    abnormalTotalByPatient.set(pid, (abnormalTotalByPatient.get(pid) ?? 0) + 1);
  }

  return { withResult, abnormalTotalByPatient };
}

export async function loadConsultationsByCaseId(
  supabase: SupabaseClient,
  tenantId: string,
  caseIds: string[]
): Promise<Map<string, ConsultationConsentInput[]>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = uniqueStrings(caseIds);
  const map = new Map<string, ConsultationConsentInput[]>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("case_id, status, quote_data")
    .eq("tenant_id", tid)
    .in("case_id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { case_id: string | null; status: string; quote_data: unknown };
    const cid = r.case_id != null ? String(r.case_id) : null;
    if (!cid) continue;
    const qd = r.quote_data && typeof r.quote_data === "object" && !Array.isArray(r.quote_data) ? (r.quote_data as Record<string, unknown>) : {};
    const row: ConsultationConsentInput = { status: String(r.status ?? ""), quote_data: qd };
    const list = map.get(cid) ?? [];
    list.push(row);
    map.set(cid, list);
  }
  return map;
}

export async function loadSurgeryReadinessBoardPayload(tenantId: string, now: Date = new Date()): Promise<SurgeryReadinessBoardPayload> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);

  const rawBookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: window.rangeStartIso,
    rangeEndIso: window.rangeEndIso,
    bookingType: "surgery",
    includeCancelled: false,
    limit: BOARD_LIMIT,
  });

  const surgeryBookings = rawBookings.filter(
    (b) =>
      b.booking_type.trim().toLowerCase() === "surgery" &&
      isActiveSurgeryBookingStatus(b.booking_status) &&
      isInstantInTenantInclusiveDayWindow(Date.parse(b.start_at), window.calendarTimezone, window.todayYmd, window.windowEndYmd)
  );

  const supabase = supabaseAdmin();
  const [bookingLabels, assigneeLabels] = await Promise.all([
    loadPatientLabelsForBookings(supabase, tid, surgeryBookings),
    loadStaffAndUserLabels(supabase, tid, surgeryBookings),
  ]);

  const caseIds = uniqueStrings(surgeryBookings.map((b) => b.case_id));
  const caseRows = caseIds.length ? await loadCasesIndexRowsForIds(tid, caseIds, supabase) : [];
  const ext = await loadCasesIndexExtensionBundle(
    tid,
    caseRows.map((r) => r.id),
    supabase
  );
  const worklistById = new Map<string, CaseWorklistRow>();
  for (const row of buildCaseWorklistRows(tid, caseRows, ext)) {
    worklistById.set(row.id, row);
  }

  const patientIdsForPathology = new Set<string>();
  for (const b of surgeryBookings) {
    const wid = b.case_id?.trim() ? worklistById.get(b.case_id.trim()) : undefined;
    const pid = b.patient_id?.trim() || (wid ? resolvePatientIdForCaseRow(wid) : null);
    if (pid) patientIdsForPathology.add(pid);
  }

  const surgeryBookingIds = surgeryBookings.map((b) => b.id);
  const [pathologySets, consultationsByCase, surgeryPayments, financialByBooking, clinicalStaffingByBooking] =
    await Promise.all([
    loadPathologyPatientSets(supabase, tid, Array.from(patientIdsForPathology)),
    loadConsultationsByCaseId(supabase, tid, caseIds),
    loadPaymentRecordsForSurgeryBoard(tid, surgeryBookingIds, caseIds),
    loadFinancialSurgeryPipelineStatusByBookings(tid, {
      todayYmd: window.todayYmd,
      calendarTimezone: window.calendarTimezone,
      bookings: surgeryBookings.map((b) => ({
        id: b.id,
        case_id: b.case_id,
        patient_id: b.patient_id,
        booking_status: b.booking_status,
        financial_os_status: b.financial_os_status ?? null,
        start_at: b.start_at,
      })),
    }),
    loadClinicalStaffingSummariesForBookings(tid, surgeryBookings, { syncExistingStaff: true }),
  ]);
  const financialClearanceByBooking = buildFinancialClearanceMapFromPipeline(
    surgeryBookings.map((b) => ({
      id: b.id,
      case_id: b.case_id,
      patient_id: b.patient_id,
      booking_status: b.booking_status,
      financial_os_status: b.financial_os_status ?? null,
      start_at: b.start_at,
    })),
    financialByBooking,
    { todayYmd: window.todayYmd, calendarTimezone: window.calendarTimezone }
  );
  let depositTracked = 0;
  let depositPending = 0;

  const columns: Record<SurgeryReadinessBoardColumnId, SurgeryReadinessBoardCard[]> = {
    ready: [],
    needs_attention: [],
    high_risk: [],
    missing_pathology: [],
    missing_consent: [],
    on_hold_not_linked: [],
  };

  const tz = window.calendarTimezone;

  for (const b of surgeryBookings) {
    const caseId = b.case_id?.trim() || null;
    const work = caseId ? worklistById.get(caseId) ?? null : null;
    const surgeryLocalYmd = calendarDateStringFromInstant(new Date(b.start_at), tz);
    const daysUntil = calendarDaysUntilSurgery(tz, window.todayYmd, b.start_at);

    const patientLabelFromCase = work?.person_label?.trim() && work.person_label.trim() !== "—" ? work.person_label.trim() : null;
    const pl =
      patientLabelFromCase ||
      (b.patient_id?.trim() ? bookingLabels.get(`patient:${b.patient_id.trim()}`) : null) ||
      (b.person_id?.trim() ? bookingLabels.get(`person:${b.person_id.trim()}`) : null) ||
      b.title?.trim() ||
      "Patient";

    let assignee: string | null = null;
    if (b.assigned_staff_id?.trim()) {
      assignee = assigneeLabels.staffNames.get(b.assigned_staff_id.trim()) ?? null;
    }
    if (!assignee && b.assigned_user_id?.trim()) {
      assignee = assigneeLabels.userEmails.get(b.assigned_user_id.trim()) ?? null;
    }

    const patientIdForPathology = b.patient_id?.trim() || (work ? resolvePatientIdForCaseRow(work) : null);
    const hasPathology = patientIdForPathology ? pathologySets.withResult.has(patientIdForPathology) : false;
    const consultRows = caseId ? consultationsByCase.get(caseId) ?? [] : [];
    const hasConsent = hasConsultationConsentSignal(consultRows);

    const abnormalN = patientIdForPathology ? pathologySets.abnormalTotalByPatient.get(patientIdForPathology) ?? 0 : 0;

    const payByBooking = surgeryPayments.byBookingId.get(b.id) ?? null;
    const payByCase = caseId ? surgeryPayments.byCaseId.get(caseId) ?? null : null;
    const surgeryPaymentRow: PaymentRecordRow | null = payByBooking ?? payByCase;
    if (surgeryPaymentRow) {
      depositTracked += 1;
      if (paymentRecordNeedsCollection(surgeryPaymentRow, window.todayYmd)) depositPending += 1;
    }

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

    const primary = pickSurgeryReadinessPrimaryColumn({
      issues,
      readinessBucket: work?.readinessBucket ?? null,
    });

    const foundationPatient = work?.foundation_patient_id?.trim() || null;
    const legacyPatient = work?.legacy_patient_id?.trim() || null;
    const patientHref = foundationPatient
      ? `/fi-admin/${tid}/patients/${encodeURIComponent(foundationPatient)}`
      : legacyPatient
        ? `/fi-admin/${tid}/patients/${encodeURIComponent(legacyPatient)}`
        : b.patient_id?.trim()
          ? `/fi-admin/${tid}/patients/${encodeURIComponent(b.patient_id.trim())}`
          : null;

    const depKey = surgeryDepositBoardLabel(surgeryPaymentRow, window.todayYmd);
    const card: SurgeryReadinessBoardCard = {
      bookingId: b.id,
      caseId,
      patientLabel: pl,
      surgeryLocalYmd,
      daysUntil,
      bookingTimeLabel: formatLocalTimeFromIso(b.start_at, tz),
      bookingStatus: b.booking_status,
      bookingStatusLabel: bookingStatusLabel(b.booking_status),
      bookingTypeLabel: bookingTypeLabel(b.booking_type),
      assigneeLabel: assignee,
      caseStatus: work?.status ?? null,
      caseStatusLabel: work ? fiCaseStatusLabel(work.status) : null,
      readinessPercent: work?.readinessPercent ?? null,
      readinessBucket: work?.readinessBucket ?? null,
      issues,
      primaryColumn: primary,
      surgeryDepositLabel: SURGERY_DEPOSIT_BOARD_COPY[depKey],
      financialPipeline: financialByBooking.get(b.id)!,
      financialClearance: financialClearanceByBooking.get(b.id)!,
      hrefs: {
        case: caseId ? caseProcedureDayDetailHref(tid, caseId) : null,
        patient: patientHref,
        calendar: `/fi-admin/${tid}/calendar?date=${encodeURIComponent(surgeryLocalYmd)}`,
        operationsCentre: `/fi-admin/${tid}/operations`,
        appointments: `/fi-admin/${tid}/appointments/${encodeURIComponent(b.id)}`,
      },
      startAt: b.start_at,
      clinicalStaffing: clinicalStaffingByBooking.get(b.id) ?? null,
    };

    columns[primary].push(card);
  }

  for (const k of Object.keys(columns) as SurgeryReadinessBoardColumnId[]) {
    columns[k].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.patientLabel.localeCompare(b.patientLabel));
  }

  return {
    window,
    columns,
    kpis: aggregateSurgeryReadinessKpis(columns, { tracked: depositTracked, pending: depositPending }),
  };
}
