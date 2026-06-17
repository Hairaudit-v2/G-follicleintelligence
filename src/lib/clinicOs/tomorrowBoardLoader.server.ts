import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadBookingsForOperatorView, MAX_OPERATOR_BOOKINGS_LIMIT } from "@/src/lib/bookings/bookings";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { buildCaseWorklistRows } from "@/src/lib/cases/casesIndexBuild";
import { loadCasesIndexExtensionBundle } from "@/src/lib/cases/casesIndexLoaders";
import type { CaseWorklistRow } from "@/src/lib/cases/casesIndexTypes";
import { loadCasesIndexRowsForIds } from "@/src/lib/cases/caseLoaders";
import {
  buildTomorrowFrontDeskChecklist,
  buildTomorrowSurgeryReadinessRows,
  computeTomorrowOperationalWindow,
  deriveTomorrowActionItems,
  isTomorrowAgendaBooking,
  reminderJobsNeedAttention,
  summarizeTomorrowBoard,
  type TomorrowActionItem,
  type TomorrowBoardSummary,
  type TomorrowChecklistItem,
  type TomorrowOperationalWindow,
  type TomorrowSurgeryReadinessDerived,
} from "@/src/lib/clinicOs/tomorrowBoardModel";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadFinancialSurgeryPipelineStatusByBookings } from "@/src/lib/financialOs/financialSurgeryPipelineStatus.server";
import type { FinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import { buildFinancialClearanceMapFromPipeline, type FinancialClearanceResult } from "@/src/lib/financialOs/financialClearance.server";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import {
  loadLatestPaymentRecordsByBookingIds,
  loadPaymentRecordsForSurgeryBoard,
} from "@/src/lib/payments/paymentRecordLoaders.server";
import { paymentRecordNeedsCollection } from "@/src/lib/payments/paymentRecordModel";
import { loadReminderJobsForBookings } from "@/src/lib/reminders/reminderJobs.server";
import {
  loadConsultationsByCaseId,
  loadPathologyPatientSets,
  loadPatientLabelsForBookings,
  loadStaffAndUserLabels,
  resolvePatientIdForCaseRow,
} from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";

const BOARD_LIMIT = Math.min(480, MAX_OPERATOR_BOOKINGS_LIMIT);

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
  const { data, error } = await supabase
    .from("fi_clinic_rooms")
    .select("id, display_name")
    .eq("tenant_id", tid)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; display_name: string | null };
    const name = String(r.display_name ?? "").trim();
    out.set(String(r.id), name || "Room");
  }
  return out;
}

async function loadPersonContactFlags(
  supabase: SupabaseClient,
  tenantId: string,
  personIds: string[]
): Promise<Map<string, { hasEmail: boolean; hasPhone: boolean }>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = uniqueStrings(personIds);
  const out = new Map<string, { hasEmail: boolean; hasPhone: boolean }>();
  if (!ids.length) return out;
  const { data, error } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tid).in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; metadata: unknown };
    const m =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    const d = displayFromPersonMetadata(m);
    out.set(String(r.id), {
      hasEmail: Boolean(d.email?.trim()),
      hasPhone: Boolean(d.phone?.trim()),
    });
  }
  return out;
}

export type TomorrowScheduleRow = {
  bookingId: string;
  startAt: string;
  timeLabel: string;
  patientLabel: string;
  bookingType: string;
  bookingTypeLabel: string;
  providerLabel: string | null;
  roomLabel: string | null;
  bookingStatus: string;
  statusLabel: string;
  paymentBadge: string | null;
  reminderAttention: boolean;
  href: string;
  /** FinancialOS + revenue snapshot for surgery rows only. */
  financialPipeline: FinancialSurgeryPipelineStatus | null;
  financialClearance: FinancialClearanceResult | null;
  caseId: string | null;
};

export type TomorrowScheduleGroup = {
  timeLabel: string;
  sortKey: string;
  rows: TomorrowScheduleRow[];
};

export type TomorrowStaffPrep = {
  assignedBookings: number;
  unassignedBookings: number;
  roomMissingBookings: number;
  assigneeCounts: { label: string; count: number }[];
};

/** Surgery readiness rows on the Tomorrow board include FinancialOS pipeline chips (loader merge only). */
export type TomorrowSurgeryReadinessBoardRow = TomorrowSurgeryReadinessDerived & {
  financialPipeline: FinancialSurgeryPipelineStatus | null;
  financialClearance: FinancialClearanceResult | null;
};

export type TomorrowBoardPayload = {
  tenantId: string;
  window: TomorrowOperationalWindow;
  summary: TomorrowBoardSummary;
  scheduleGroups: TomorrowScheduleGroup[];
  surgeryReadiness: TomorrowSurgeryReadinessBoardRow[];
  checklist: TomorrowChecklistItem[];
  staffPrep: TomorrowStaffPrep;
  actions: TomorrowActionItem[];
};

export async function loadTomorrowBoardPayload(tenantId: string, now: Date = new Date()): Promise<TomorrowBoardPayload> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const window = computeTomorrowOperationalWindow(now, calendarTimezone);

  const rawBookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: window.localStartIso,
    rangeEndIso: window.localEndIso,
    includeCancelled: false,
    limit: BOARD_LIMIT,
  });

  const agendaBookings = rawBookings.filter((b) => isTomorrowAgendaBooking(b, window));
  const surgeryBookings = agendaBookings.filter((b) => b.booking_type.trim().toLowerCase() === "surgery");

  const supabase = supabaseAdmin();
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

  const surgeryBookingIds = surgeryBookings.map((b) => b.id);
  const personIds = uniqueStrings(agendaBookings.map((b) => b.person_id));
  const roomIds = uniqueStrings(agendaBookings.map((b) => b.room_id));

  const [bookingLabels, assigneeLabels, pathologySets, consultationsByCase, surgeryPayments, paymentByBookingId, reminderMap, roomNames, personContacts] =
    await Promise.all([
      loadPatientLabelsForBookings(supabase, tid, agendaBookings),
      loadStaffAndUserLabels(supabase, tid, agendaBookings),
      (async () => {
        const patientIdsForPathology = new Set<string>();
        for (const b of surgeryBookings) {
          const wid = b.case_id?.trim() ? worklistById.get(b.case_id.trim()) : undefined;
          const pid = b.patient_id?.trim() || (wid ? resolvePatientIdForCaseRow(wid) : null);
          if (pid) patientIdsForPathology.add(pid);
        }
        return loadPathologyPatientSets(supabase, tid, Array.from(patientIdsForPathology));
      })(),
      loadConsultationsByCaseId(supabase, tid, caseIds),
      loadPaymentRecordsForSurgeryBoard(tid, surgeryBookingIds, caseIds),
      loadLatestPaymentRecordsByBookingIds(
        tid,
        agendaBookings.map((b) => b.id)
      ),
      loadReminderJobsForBookings(
        tid,
        agendaBookings.map((b) => b.id)
      ),
      loadRoomDisplayNamesById(supabase, tid, roomIds),
      loadPersonContactFlags(supabase, tid, personIds),
    ]);

  function patientLabelForBooking(b: FiBookingRow, work: CaseWorklistRow | null): string {
    const fromCase = work?.person_label?.trim() && work.person_label.trim() !== "—" ? work.person_label.trim() : null;
    return (
      fromCase ||
      (b.patient_id?.trim() ? bookingLabels.get(`patient:${b.patient_id.trim()}`) : null) ||
      (b.person_id?.trim() ? bookingLabels.get(`person:${b.person_id.trim()}`) : null) ||
      b.title?.trim() ||
      "Patient"
    );
  }

  function bookingLabel(b: FiBookingRow): string {
    const caseId = b.case_id?.trim() || null;
    const work = caseId ? worklistById.get(caseId) ?? null : null;
    return patientLabelForBooking(b, work);
  }

  const surgeryReadiness = buildTomorrowSurgeryReadinessRows({
    window,
    surgeryBookings,
    worklistByCaseId: worklistById,
    pathology: pathologySets,
    consultationsByCaseId: consultationsByCase,
    surgeryPayments,
    resolvePatientIdForCaseRow,
    patientLabelForBooking,
  });

  const summary = summarizeTomorrowBoard(agendaBookings, surgeryReadiness, window.todayYmd, surgeryPayments);

  const checklist = buildTomorrowFrontDeskChecklist({
    agendaBookings,
    consultationsByCaseId: consultationsByCase,
    paymentByBookingId,
    todayYmd: window.todayYmd,
    personContactByPersonId: personContacts,
    bookingLabel,
  });

  const actions = deriveTomorrowActionItems({
    window,
    agendaBookings,
    surgeryReadiness,
    surgeryPayments,
    bookingLabel,
  });

  const financialByBooking = await loadFinancialSurgeryPipelineStatusByBookings(tid, {
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
  });

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

  const surgeryReadinessWithFinancial: TomorrowSurgeryReadinessBoardRow[] = surgeryReadiness.map((row) => ({
    ...row,
    financialPipeline: financialByBooking.get(row.bookingId) ?? null,
    financialClearance: financialClearanceByBooking.get(row.bookingId) ?? null,
  }));

  let assignedBookings = 0;
  let unassignedBookings = 0;
  let roomMissingBookings = 0;
  const assigneeTally = new Map<string, number>();

  for (const b of agendaBookings) {
    const hasStaff = Boolean(b.assigned_staff_id?.trim() || b.assigned_user_id?.trim());
    if (hasStaff) {
      assignedBookings += 1;
      let assignee: string | null = null;
      if (b.assigned_staff_id?.trim()) assignee = assigneeLabels.staffNames.get(b.assigned_staff_id.trim()) ?? null;
      if (!assignee && b.assigned_user_id?.trim()) assignee = assigneeLabels.userEmails.get(b.assigned_user_id.trim()) ?? null;
      const label = assignee ?? "Staff";
      assigneeTally.set(label, (assigneeTally.get(label) ?? 0) + 1);
    } else {
      unassignedBookings += 1;
    }
    if (b.room_required && !b.room_id?.trim()) roomMissingBookings += 1;
  }

  const assigneeCounts = Array.from(assigneeTally.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const staffPrep: TomorrowStaffPrep = {
    assignedBookings,
    unassignedBookings,
    roomMissingBookings,
    assigneeCounts,
  };

  const tz = window.calendarTimezone;
  const baseHref = `/fi-admin/${tid}`;

  const scheduleRows: TomorrowScheduleRow[] = agendaBookings.map((b) => {
    let assignee: string | null = null;
    if (b.assigned_staff_id?.trim()) assignee = assigneeLabels.staffNames.get(b.assigned_staff_id.trim()) ?? null;
    if (!assignee && b.assigned_user_id?.trim()) assignee = assigneeLabels.userEmails.get(b.assigned_user_id.trim()) ?? null;

    const pay = paymentByBookingId.get(b.id) ?? null;
    let paymentBadge: string | null = null;
    if (pay) {
      paymentBadge = paymentRecordNeedsCollection(pay, window.todayYmd) ? "Payment due" : "Payment on file";
    }

    const rid = b.room_id?.trim();
    const roomLabel = rid ? roomNames.get(rid) ?? null : null;

    const jobs = reminderMap.get(b.id);

    const isSurgery = b.booking_type.trim().toLowerCase() === "surgery";

    return {
      bookingId: b.id,
      startAt: b.start_at,
      timeLabel: formatLocalTimeFromIso(b.start_at, tz),
      patientLabel: bookingLabel(b),
      bookingType: b.booking_type,
      bookingTypeLabel: bookingTypeLabel(b.booking_type),
      providerLabel: assignee,
      roomLabel,
      bookingStatus: b.booking_status,
      statusLabel: bookingStatusLabel(b.booking_status),
      paymentBadge,
      reminderAttention: reminderJobsNeedAttention(jobs),
      href: `${baseHref}/appointments/${encodeURIComponent(b.id)}`,
      financialPipeline: isSurgery ? financialByBooking.get(b.id) ?? null : null,
      financialClearance: isSurgery ? financialClearanceByBooking.get(b.id) ?? null : null,
      caseId: b.case_id?.trim() || null,
    };
  });

  scheduleRows.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.patientLabel.localeCompare(b.patientLabel));

  const groupMap = new Map<string, TomorrowScheduleRow[]>();
  for (const row of scheduleRows) {
    const k = row.timeLabel || "—";
    const list = groupMap.get(k) ?? [];
    list.push(row);
    groupMap.set(k, list);
  }

  const scheduleGroups: TomorrowScheduleGroup[] = Array.from(groupMap.entries())
    .map(([timeLabel, rows]) => ({
      timeLabel,
      sortKey: rows[0]?.startAt ?? timeLabel,
      rows,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return {
    tenantId: tid,
    window,
    summary,
    scheduleGroups,
    surgeryReadiness: surgeryReadinessWithFinancial,
    checklist,
    staffPrep,
    actions,
  };
}
