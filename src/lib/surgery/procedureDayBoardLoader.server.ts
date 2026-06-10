import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { buildCaseWorklistRows } from "@/src/lib/cases/casesIndexBuild";
import { loadCasesIndexExtensionBundle } from "@/src/lib/cases/casesIndexLoaders";
import type { CaseWorklistRow } from "@/src/lib/cases/casesIndexTypes";
import { loadCasesIndexRowsForIds } from "@/src/lib/cases/caseLoaders";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";
import { procedureStatusLabel } from "@/src/lib/cases/procedureDayLabels";
import { caseProcedureDayDetailHref } from "@/src/lib/cases/caseDetailNavConstants";
import { loadPaymentRecordsForSurgeryBoard } from "@/src/lib/payments/paymentRecordLoaders.server";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { paymentRecordNeedsCollection, surgeryDepositBoardLabel, SURGERY_DEPOSIT_BOARD_COPY } from "@/src/lib/payments/paymentRecordModel";
import {
  buildProcedureDayActionItems,
  buildPreOpChecklistFlags,
  buildTodayProcedureReadinessIssues,
  computeProcedureDayBoardWindow,
  deriveSurgeryDayPipelinePhase,
  emptyProcedureDayProgressCounts,
  accumulateProcedureProgressCounts,
  isBookingStartOnTenantLocalDay,
  summarizeProcedureDayBoard,
  type ProcedureDayActionItem,
  type ProcedureDayBoardSummary,
  type ProcedureDayBoardWindow,
  type ProcedureDayProgressCounts,
  type PreOpChecklistFlags,
} from "@/src/lib/surgery/procedureDayBoardModel";
import {
  loadConsultationsByCaseId,
  loadPathologyPatientSets,
  loadPatientLabelsForBookings,
  loadStaffAndUserLabels,
  resolvePatientIdForCaseRow,
} from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import { hasHighRiskSeverity, isActiveSurgeryBookingStatus, hasConsultationConsentSignal } from "@/src/lib/surgery/surgeryReadinessBoardModel";

const BOARD_LIMIT = 240;

function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id?.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

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

async function loadRoomDisplayNamesById(
  supabase: SupabaseClient,
  tenantId: string,
  roomIds: string[]
): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const ids = uniqueStrings(roomIds);
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await supabase.from("fi_clinic_rooms").select("id, display_name").eq("tenant_id", tid).in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; display_name: string | null };
    const name = String(r.display_name ?? "").trim();
    out.set(String(r.id), name || "Room");
  }
  return out;
}

async function loadFiUserEmailsById(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[]
): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const ids = uniqueStrings(userIds);
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await supabase.from("fi_users").select("id, email").eq("tenant_id", tid).in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; email: string | null };
    out.set(String(r.id), String(r.email ?? "").trim() || "User");
  }
  return out;
}

function formatGraftTarget(work: CaseWorklistRow | null): string | null {
  const plan = work?.surgeryPlan;
  if (!plan) return null;
  const min = plan.estimated_grafts_min;
  const max = plan.estimated_grafts_max;
  if (min != null && max != null) {
    if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
    if (Number.isFinite(min) && Number.isFinite(max) && min === max) return String(min);
    if (Number.isFinite(min) && Number.isFinite(max)) return `${min}–${max}`;
  }
  if (min != null && Number.isFinite(min)) return `${min}+`;
  if (max != null && Number.isFinite(max)) return `≤${max}`;
  return null;
}

function extractionImplantationSummary(proc: CaseWorklistRow["procedureDay"]): string | null {
  if (!proc) return null;
  const parts: string[] = [];
  const ex = proc.grafts_extracted;
  const im = proc.grafts_implanted;
  if (ex != null && Number.isFinite(ex)) parts.push(`Extracted ${ex} grafts`);
  if (im != null && Number.isFinite(im)) parts.push(`Implanted ${im} grafts`);
  const em = proc.extraction_method?.trim();
  const imeth = proc.implantation_method?.trim();
  if (em) parts.push(`Extraction: ${em}`);
  if (imeth) parts.push(`Implantation: ${imeth}`);
  return parts.length ? parts.join(" · ") : null;
}

export type ProcedureDayScheduleCard = {
  bookingId: string;
  startAt: string;
  timeLabel: string;
  patientLabel: string;
  caseId: string | null;
  /** Treatment / case type line for the card (not the internal UUID). */
  caseLabel: string | null;
  procedureType: string | null;
  graftTargetLabel: string | null;
  calendarAssigneeLabel: string | null;
  procedureSurgeonLabel: string | null;
  procedureNurseLabel: string | null;
  procedureTechnicianLabels: string[];
  teamMemberLabels: string[];
  roomLabel: string | null;
  procedureRoomText: string | null;
  bookingStatus: string;
  bookingStatusLabel: string;
  bookingTypeLabel: string;
  readinessPercent: number | null;
  readinessBucketLabel: string | null;
  readinessBucket: CaseWorklistRow["readinessBucket"] | null;
  surgeryDepositBadge: string | null;
  issues: ReturnType<typeof buildTodayProcedureReadinessIssues>;
  preOp: PreOpChecklistFlags;
  procedureProgress: {
    rowExists: boolean;
    statusRaw: string | null;
    statusLabel: string | null;
    startTime: string | null;
    finishTime: string | null;
    extractionImplantSummary: string | null;
  };
  pipelinePhase: ReturnType<typeof deriveSurgeryDayPipelinePhase>;
  hrefs: { appointment: string; case: string | null; patient: string | null; calendar: string };
};

export type ProcedureDayBoardPayload = {
  tenantId: string;
  window: ProcedureDayBoardWindow;
  summary: ProcedureDayBoardSummary;
  procedureProgressCounts: ProcedureDayProgressCounts;
  scheduleGroups: { timeLabel: string; sortKey: string; cards: ProcedureDayScheduleCard[] }[];
  actions: ProcedureDayActionItem[];
};

export async function loadProcedureDayBoardPayload(tenantId: string, now: Date = new Date()): Promise<ProcedureDayBoardPayload> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const window = computeProcedureDayBoardWindow(now, calendarTimezone);

  const rawBookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: window.rangeStartIso,
    rangeEndIso: window.rangeEndIso,
    bookingType: "surgery",
    includeCancelled: false,
    limit: BOARD_LIMIT,
  });

  const tz = window.calendarTimezone;
  const todayYmd = window.todayYmd;

  const surgeryBookings = rawBookings.filter(
    (b) =>
      b.booking_type.trim().toLowerCase() === "surgery" &&
      isActiveSurgeryBookingStatus(b.booking_status) &&
      isBookingStartOnTenantLocalDay(b.start_at, tz, todayYmd)
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
  const roomIds = uniqueStrings(surgeryBookings.map((b) => b.room_id));

  const procUserIds = new Set<string>();
  for (const w of Array.from(worklistById.values())) {
    const p = w.procedureDay;
    if (p?.surgeon_user_id?.trim()) procUserIds.add(p.surgeon_user_id.trim());
    if (p?.nurse_user_id?.trim()) procUserIds.add(p.nurse_user_id.trim());
    for (const uid of p?.technician_user_ids ?? []) {
      if (uid.trim()) procUserIds.add(uid.trim());
    }
    for (const uid of p?.team_member_user_ids ?? []) {
      if (uid.trim()) procUserIds.add(uid.trim());
    }
  }

  const [pathologySets, consultationsByCase, surgeryPayments, roomNames, fiUserLabels] = await Promise.all([
    loadPathologyPatientSets(supabase, tid, Array.from(patientIdsForPathology)),
    loadConsultationsByCaseId(supabase, tid, caseIds),
    loadPaymentRecordsForSurgeryBoard(tid, surgeryBookingIds, caseIds),
    loadRoomDisplayNamesById(supabase, tid, roomIds),
    loadFiUserEmailsById(supabase, tid, Array.from(procUserIds)),
  ]);

  const phases: ReturnType<typeof deriveSurgeryDayPipelinePhase>[] = [];
  const flagRows: { highRisk: boolean; unassignedTeam: boolean; missingRoom: boolean }[] = [];
  const cards: ProcedureDayScheduleCard[] = [];
  const actions: ProcedureDayActionItem[] = [];
  const procedureProgressCounts = emptyProcedureDayProgressCounts();

  const base = `/fi-admin/${tid}`;

  for (const b of surgeryBookings) {
    const caseId = b.case_id?.trim() || null;
    const work = caseId ? worklistById.get(caseId) ?? null : null;

    const patientLabelFromCase = work?.person_label?.trim() && work.person_label.trim() !== "—" ? work.person_label.trim() : null;
    const patientLabel =
      patientLabelFromCase ||
      (b.patient_id?.trim() ? bookingLabels.get(`patient:${b.patient_id.trim()}`) : null) ||
      (b.person_id?.trim() ? bookingLabels.get(`person:${b.person_id.trim()}`) : null) ||
      b.title?.trim() ||
      "Patient";

    let calendarAssignee: string | null = null;
    if (b.assigned_staff_id?.trim()) {
      calendarAssignee = assigneeLabels.staffNames.get(b.assigned_staff_id.trim()) ?? null;
    }
    if (!calendarAssignee && b.assigned_user_id?.trim()) {
      calendarAssignee = assigneeLabels.userEmails.get(b.assigned_user_id.trim()) ?? null;
    }

    const proc = work?.procedureDay ?? null;
    const surgeonUserId = proc?.surgeon_user_id?.trim() || null;
    const nurseUserId = proc?.nurse_user_id?.trim() || null;
    const procedureSurgeonLabel = surgeonUserId ? fiUserLabels.get(surgeonUserId) ?? null : null;
    const procedureNurseLabel = nurseUserId ? fiUserLabels.get(nurseUserId) ?? null : null;
    const procedureTechnicianLabels = (proc?.technician_user_ids ?? [])
      .map((id) => fiUserLabels.get(id.trim()))
      .filter((x): x is string => Boolean(x?.trim()));
    const teamMemberLabels = (proc?.team_member_user_ids ?? [])
      .map((id) => fiUserLabels.get(id.trim()))
      .filter((x): x is string => Boolean(x?.trim()));

    const rid = b.room_id?.trim();
    const roomLabel = rid ? roomNames.get(rid) ?? null : null;

    const patientIdForPathology = b.patient_id?.trim() || (work ? resolvePatientIdForCaseRow(work) : null);
    const hasPathology = patientIdForPathology ? pathologySets.withResult.has(patientIdForPathology) : false;
    const consultRows = caseId ? consultationsByCase.get(caseId) ?? [] : [];
    const hasConsent = hasConsultationConsentSignal(consultRows);
    const abnormalN = patientIdForPathology ? pathologySets.abnormalTotalByPatient.get(patientIdForPathology) ?? 0 : 0;

    const payByBooking = surgeryPayments.byBookingId.get(b.id) ?? null;
    const payByCase = caseId ? surgeryPayments.byCaseId.get(caseId) ?? null : null;
    const surgeryPaymentRow: PaymentRecordRow | null = payByBooking ?? payByCase;

    const issues = buildTodayProcedureReadinessIssues({
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
      todayYmd,
    });

    const hasBookingAssignee = Boolean(b.assigned_staff_id?.trim() || b.assigned_user_id?.trim());
    const hasProcedureSurgeon = Boolean(surgeonUserId);
    const hasRoom = Boolean(rid);
    const roomRequired = Boolean(b.room_required);

    const preOp = buildPreOpChecklistFlags({
      caseId,
      consultRows,
      hasPathologyResult: hasPathology,
      surgeryPaymentRecord: surgeryPaymentRow,
      todayYmd,
      hasSurgeryPlanRow: Boolean(work?.surgeryPlan),
      surgeryPlanningComplete: work ? work.readinessSurgeryPlanningHealth === "complete" : false,
      hasBookingAssignee,
      hasProcedureSurgeon,
      roomRequired,
      hasRoom,
    });

    const pipelinePhase = deriveSurgeryDayPipelinePhase({
      bookingStatus: b.booking_status,
      procedureStatus: proc?.procedure_status ?? null,
      readinessBucket: work?.readinessBucket ?? null,
    });

    phases.push(pipelinePhase);
    flagRows.push({
      highRisk: hasHighRiskSeverity(issues),
      unassignedTeam: !hasBookingAssignee && !hasProcedureSurgeon,
      missingRoom: roomRequired && !hasRoom,
    });

    accumulateProcedureProgressCounts(procedureProgressCounts, proc?.procedure_status ?? null, Boolean(proc));

    let surgeryDepositBadge: string | null = null;
    if (surgeryPaymentRow) {
      surgeryDepositBadge = paymentRecordNeedsCollection(surgeryPaymentRow, todayYmd)
        ? "Payment due"
        : SURGERY_DEPOSIT_BOARD_COPY[surgeryDepositBoardLabel(surgeryPaymentRow, todayYmd)];
    }

    const foundationPatient = work?.foundation_patient_id?.trim() || null;
    const legacyPatient = work?.legacy_patient_id?.trim() || null;
    const patientHref = foundationPatient
      ? `${base}/patients/${encodeURIComponent(foundationPatient)}`
      : legacyPatient
        ? `${base}/patients/${encodeURIComponent(legacyPatient)}`
        : b.patient_id?.trim()
          ? `${base}/patients/${encodeURIComponent(b.patient_id.trim())}`
          : null;

    const surgeryLocalYmd = todayYmd;

    const card: ProcedureDayScheduleCard = {
      bookingId: b.id,
      startAt: b.start_at,
      timeLabel: formatLocalTimeFromIso(b.start_at, tz),
      patientLabel,
      caseId,
      caseLabel: work
        ? work.treatment_type?.trim() || work.case_type?.trim() || fiCaseStatusLabel(work.status)
        : null,
      procedureType: work?.surgeryPlan?.planned_procedure_type?.trim() || null,
      graftTargetLabel: formatGraftTarget(work),
      calendarAssigneeLabel: calendarAssignee,
      procedureSurgeonLabel,
      procedureNurseLabel,
      procedureTechnicianLabels,
      teamMemberLabels,
      roomLabel,
      procedureRoomText: proc?.procedure_room?.trim() || null,
      bookingStatus: b.booking_status,
      bookingStatusLabel: bookingStatusLabel(b.booking_status),
      bookingTypeLabel: bookingTypeLabel(b.booking_type),
      readinessPercent: work?.readinessPercent ?? null,
      readinessBucketLabel: work?.readinessBucket ? work.readinessBucket.replace(/_/g, " ") : null,
      readinessBucket: work?.readinessBucket ?? null,
      surgeryDepositBadge,
      issues,
      preOp,
      procedureProgress: {
        rowExists: Boolean(proc),
        statusRaw: proc?.procedure_status ?? null,
        statusLabel: proc ? procedureStatusLabel(proc.procedure_status) : null,
        startTime: proc?.start_time ?? null,
        finishTime: proc?.finish_time ?? null,
        extractionImplantSummary: extractionImplantationSummary(proc),
      },
      pipelinePhase,
      hrefs: {
        appointment: `${base}/appointments/${encodeURIComponent(b.id)}`,
        case: caseId ? caseProcedureDayDetailHref(tid, caseId) : null,
        patient: patientHref,
        calendar: `${base}/calendar?date=${encodeURIComponent(surgeryLocalYmd)}`,
      },
    };
    cards.push(card);

    actions.push(
      ...buildProcedureDayActionItems({
        tenantId: tid,
        bookingId: b.id,
        caseId,
        patientLabel,
        bookingStatus: b.booking_status,
        abnormalPathologyCount: abnormalN,
        hasBookingAssignee,
        hasProcedureSurgeon,
        roomRequired,
        hasRoom,
        procedureRowExists: Boolean(proc),
        procedureStatus: proc?.procedure_status ?? null,
        surgeryPaymentRecord: surgeryPaymentRow,
        todayYmd,
      })
    );
  }

  cards.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.patientLabel.localeCompare(b.patientLabel));

  const groupMap = new Map<string, ProcedureDayScheduleCard[]>();
  for (const c of cards) {
    const k = c.timeLabel || "—";
    const list = groupMap.get(k) ?? [];
    list.push(c);
    groupMap.set(k, list);
  }

  const scheduleGroups = Array.from(groupMap.entries())
    .map(([timeLabel, groupCards]) => ({
      timeLabel,
      sortKey: groupCards[0]?.startAt ?? timeLabel,
      cards: groupCards,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const summary = summarizeProcedureDayBoard(phases, flagRows);

  actions.sort((a, b) => a.patientLabel.localeCompare(b.patientLabel) || a.kind.localeCompare(b.kind));

  return {
    tenantId: tid,
    window,
    summary,
    procedureProgressCounts,
    scheduleGroups,
    actions,
  };
}
