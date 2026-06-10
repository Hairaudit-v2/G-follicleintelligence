import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertMetadataJsonObject } from "@/src/lib/bookings/bookingPolicy";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  aggregateConsultationConversionKpis,
  calendarYmdFromIsoInstant,
  calendarYmdInInclusiveRange,
  computeConsultationConversionBoardWindow,
  daysSinceCalendarYmd,
  hasQuoteDraftSignals,
  hasSurgeryBookedSignal,
  isConsultationArchivedSignal,
  isCrmLostSignal,
  nextRecommendedAction,
  normalizeQuoteStatusFromSignals,
  pickConsultationConversionColumn,
  type ConsultationConversionBoardColumnId,
  type ConsultationConversionBoardWindow,
  type ConsultationConversionKpis,
} from "@/src/lib/consultations/consultationConversionBoardModel";
import { mapFiConsultationRow } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationRow, ConsultationTypeId } from "@/src/lib/consultations/consultationTypes";
import { CONSULTATION_TYPE_DEFINITIONS } from "@/src/lib/consultations/consultationTypeConfig";
import { resolveConsultationConsultantDisplayName } from "@/src/lib/consultations/consultationConsultantDisplay";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { loadPaymentRecordsForConsultations } from "@/src/lib/payments/paymentRecordLoaders.server";
import { CONSULTATION_DEPOSIT_BOARD_COPY, consultationDepositBoardLabel } from "@/src/lib/payments/paymentRecordModel";

const BOARD_BOOKING_LIMIT = 500;
const CONSULTATION_FETCH_LIMIT = 800;
const IN_CHUNK = 80;

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id?.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function consultationTypeLabel(id: ConsultationTypeId): string {
  return CONSULTATION_TYPE_DEFINITIONS.find((d) => d.id === id)?.label ?? id;
}

function readPatientMetadataLabel(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  const dn = m.display_name;
  const pn = m.patient_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  if (typeof pn === "string" && pn.trim()) return pn.trim();
  return null;
}

function isActiveSurgeryBooking(row: FiBookingRow): boolean {
  const t = row.booking_type.trim().toLowerCase();
  if (t !== "surgery") return false;
  if (row.booking_status.trim().toLowerCase() === "cancelled") return false;
  if (row.cancelled_at?.trim()) return false;
  return true;
}

function isConsultationBooking(row: FiBookingRow): boolean {
  return row.booking_type.trim().toLowerCase() === "consultation";
}

function consultationInDateWindow(
  row: ConsultationRow,
  bookingById: Map<string, FiBookingRow>,
  window: ConsultationConversionBoardWindow,
  nowMs: number
): boolean {
  const tz = window.calendarTimezone;
  const ymd = row.consultation_date?.trim() || null;
  if (ymd && calendarYmdInInclusiveRange(ymd, window.ymdPast90, window.ymdFuture30)) return true;

  const bid = row.booking_id?.trim();
  if (bid) {
    const b = bookingById.get(bid);
    if (b) {
      const bymd = calendarYmdFromIsoInstant(b.start_at, tz);
      if (bymd && calendarYmdInInclusiveRange(bymd, window.ymdPast90, window.ymdFuture30)) return true;
    }
  }

  if (!ymd) {
    const u = Date.parse(row.updated_at);
    if (Number.isFinite(u) && u >= nowMs - 95 * 86_400_000) return true;
  }

  return false;
}

export type ConsultationConversionBoardCard = {
  id: string;
  consultationId: string | null;
  bookingId: string | null;
  primaryColumn: ConsultationConversionBoardColumnId;
  patientOrLeadLabel: string;
  consultantLabel: string | null;
  consultationDateYmd: string | null;
  consultationDateLabel: string;
  daysSinceConsultation: number | null;
  quoteStatusDisplay: string | null;
  graftOrTreatmentLine: string | null;
  leadStageLabel: string | null;
  caseId: string | null;
  caseLabel: string | null;
  nextAction: string;
  /** Manual consultation deposit line for the conversion board. */
  depositBoardLine: string;
  hrefs: {
    consultation: string | null;
    lead: string | null;
    patient: string | null;
    case: string | null;
    appointment: string | null;
  };
};

export type ConsultationConversionBoardPayload = {
  window: ConsultationConversionBoardWindow;
  columns: Record<ConsultationConversionBoardColumnId, ConsultationConversionBoardCard[]>;
  kpis: ConsultationConversionKpis;
};

async function loadPatientLabels(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const out = new Map<string, string>();
  const ids = uniqueIds(patientIds);
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase.from("fi_patients").select("id, metadata").eq("tenant_id", tid).in("id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; metadata: unknown };
      const lab = readPatientMetadataLabel(r.metadata);
      if (lab) out.set(String(r.id), lab);
    }
  }
  return out;
}

async function loadPersonLabels(supabase: SupabaseClient, tenantId: string, personIds: string[]): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const out = new Map<string, string>();
  const ids = uniqueIds(personIds);
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase.from("fi_persons").select("id, metadata").eq("tenant_id", tid).in("id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; metadata: unknown };
      const meta =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : {};
      const { name } = displayFromPersonMetadata(meta);
      if (name && name !== "—") out.set(String(r.id), name);
    }
  }
  return out;
}

async function loadStaffDisplayNames(supabase: SupabaseClient, tenantId: string, staffIds: string[]): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const out = new Map<string, string>();
  const ids = uniqueIds(staffIds);
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase
      .from("fi_staff")
      .select("id, full_name, display_name, email")
      .eq("tenant_id", tid)
      .in("id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; full_name: string | null; display_name: string | null; email: string | null };
      const label =
        String(r.display_name ?? "").trim() ||
        String(r.full_name ?? "").trim() ||
        String(r.email ?? "").trim() ||
        "Staff";
      out.set(String(r.id), label);
    }
  }
  return out;
}

async function loadUserEmails(supabase: SupabaseClient, tenantId: string, userIds: string[]): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const out = new Map<string, string>();
  const ids = uniqueIds(userIds);
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase.from("fi_users").select("id, email").eq("tenant_id", tid).in("id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; email: string | null };
      const e = String(r.email ?? "").trim();
      if (e) out.set(String(r.id), e);
    }
  }
  return out;
}

type LeadStageBundle = {
  leadSummary: string | null;
  leadStatus: string | null;
  currentStageId: string | null;
  leadPatientId: string | null;
  leadCaseId: string | null;
  leadPersonId: string | null;
};

async function loadLeadBundles(
  supabase: SupabaseClient,
  tenantId: string,
  leadIds: string[]
): Promise<Map<string, LeadStageBundle>> {
  const tid = tenantId.trim();
  const out = new Map<string, LeadStageBundle>();
  const ids = uniqueIds(leadIds);
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select("id, summary, status, current_stage_id, patient_id, case_id, person_id")
      .eq("tenant_id", tid)
      .in("id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as {
        id: string;
        summary: string | null;
        status: string | null;
        current_stage_id: string | null;
        patient_id: string | null;
        case_id: string | null;
        person_id: string | null;
      };
      out.set(String(r.id), {
        leadSummary: r.summary,
        leadStatus: r.status != null ? String(r.status) : null,
        currentStageId: r.current_stage_id != null ? String(r.current_stage_id) : null,
        leadPatientId: r.patient_id != null ? String(r.patient_id) : null,
        leadCaseId: r.case_id != null ? String(r.case_id) : null,
        leadPersonId: r.person_id != null ? String(r.person_id) : null,
      });
    }
  }
  return out;
}

async function loadStageMeta(
  supabase: SupabaseClient,
  tenantId: string,
  stageIds: string[]
): Promise<Map<string, { label: string; isLost: boolean }>> {
  const tid = tenantId.trim();
  const out = new Map<string, { label: string; isLost: boolean }>();
  const ids = uniqueIds(stageIds);
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase.from("fi_crm_pipeline_stages").select("id, label, is_lost").eq("tenant_id", tid).in("id", part);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const r = raw as { id: string; label: string | null; is_lost: boolean | null };
      out.set(String(r.id), { label: String(r.label ?? "").trim() || "Stage", isLost: Boolean(r.is_lost) });
    }
  }
  return out;
}

async function loadSurgeryBookingsForAnchors(
  supabase: SupabaseClient,
  tenantId: string,
  leadIds: string[],
  patientIds: string[],
  caseIds: string[],
  personIds: string[]
): Promise<FiBookingRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const lids = uniqueIds(leadIds);
  const pids = uniqueIds(patientIds);
  const cids = uniqueIds(caseIds);
  const perIds = uniqueIds(personIds);
  if (lids.length === 0 && pids.length === 0 && cids.length === 0 && perIds.length === 0) return [];

  const collected: FiBookingRow[] = [];
  const mapBookingRow = (row: Record<string, unknown>): FiBookingRow => {
    const meta = row.metadata;
    assertMetadataJsonObject(meta);
    return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    room_id: row.room_id != null ? String(row.room_id) : null,
    room_required: row.room_required == null ? true : Boolean(row.room_required),
    assigned_staff_id: row.assigned_staff_id != null ? String(row.assigned_staff_id) : null,
    assigned_user_id: row.assigned_user_id != null ? String(row.assigned_user_id) : null,
    booking_type: String(row.booking_type),
    booking_status: String(row.booking_status),
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    start_at: String(row.start_at),
    end_at: String(row.end_at),
    timezone: row.timezone != null ? String(row.timezone) : null,
    location: row.location != null ? String(row.location) : null,
    metadata: meta,
    cancelled_at: row.cancelled_at != null ? String(row.cancelled_at) : null,
    cancelled_by_user_id: row.cancelled_by_user_id != null ? String(row.cancelled_by_user_id) : null,
    cancellation_reason: row.cancellation_reason != null ? String(row.cancellation_reason) : null,
    created_by_user_id: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    created_at: String(row.created_at ?? row.start_at),
    updated_at: String(row.updated_at ?? row.start_at),
  };
  };

  const runOr = async (col: "lead_id" | "patient_id" | "case_id" | "person_id", values: string[]) => {
    for (const part of chunk(values, 40)) {
      let q = supabase
        .from("fi_bookings")
        .select("*")
        .eq("tenant_id", tid)
        .eq("booking_type", "surgery")
        .neq("booking_status", "cancelled")
        .in(col, part);
      const { data, error } = await q.limit(200);
      if (error) throw new Error(error.message);
      for (const raw of data ?? []) {
        collected.push(mapBookingRow(raw as Record<string, unknown>));
      }
    }
  };

  await runOr("lead_id", lids);
  await runOr("patient_id", pids);
  await runOr("case_id", cids);
  await runOr("person_id", perIds);

  const seen = new Set<string>();
  return collected.filter((b) => {
    if (!isActiveSurgeryBooking(b)) return false;
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

function buildSurgeryPresenceSets(surgeryBookings: FiBookingRow[]): {
  byLead: Set<string>;
  byPatient: Set<string>;
  byCase: Set<string>;
  byPerson: Set<string>;
} {
  const byLead = new Set<string>();
  const byPatient = new Set<string>();
  const byCase = new Set<string>();
  const byPerson = new Set<string>();
  for (const b of surgeryBookings) {
    if (b.lead_id?.trim()) byLead.add(b.lead_id.trim());
    if (b.patient_id?.trim()) byPatient.add(b.patient_id.trim());
    if (b.case_id?.trim()) byCase.add(b.case_id.trim());
    if (b.person_id?.trim()) byPerson.add(b.person_id.trim());
  }
  return { byLead, byPatient, byCase, byPerson };
}

function resolveSurgeryLinked(
  surgerySets: { byLead: Set<string>; byPatient: Set<string>; byCase: Set<string>; byPerson: Set<string> },
  input: {
    leadId: string | null;
    patientId: string | null;
    personId: string | null;
    caseId: string | null;
    leadCaseId: string | null;
    leadPatientId: string | null;
    leadPersonId: string | null;
  }
): boolean {
  const lid = input.leadId?.trim() || null;
  const pid = input.patientId?.trim() || input.leadPatientId?.trim() || null;
  const cid = input.caseId?.trim() || input.leadCaseId?.trim() || null;
  const perId = input.personId?.trim() || input.leadPersonId?.trim() || null;
  if (cid && surgerySets.byCase.has(cid)) return true;
  if (lid && surgerySets.byLead.has(lid)) return true;
  if (pid && surgerySets.byPatient.has(pid)) return true;
  if (perId && surgerySets.byPerson.has(perId)) return true;
  return false;
}

function formatGraftLine(quoteData: Record<string, unknown>, consultationType: ConsultationTypeId): string | null {
  const graft = quoteData.graft_estimate;
  const graftStr = typeof graft === "string" ? graft.trim() : typeof graft === "number" ? String(graft) : "";
  const typeLabel = consultationTypeLabel(consultationType);
  if (graftStr) return `${graftStr} grafts · ${typeLabel}`;
  return typeLabel;
}

export async function loadConsultationConversionBoardPayload(tenantId: string, now: Date = new Date()): Promise<ConsultationConversionBoardPayload> {
  const tid = tenantId.trim();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const window = computeConsultationConversionBoardWindow(now, calendarTimezone);
  const nowMs = now.getTime();

  const supabase = supabaseAdmin();
  const isoUpdatedSince = new Date(nowMs - 100 * 86_400_000).toISOString();

  const { data: consultRaw, error: ce } = await supabase
    .from("fi_consultations")
    .select("*")
    .eq("tenant_id", tid)
    .gte("updated_at", isoUpdatedSince)
    .order("updated_at", { ascending: false })
    .limit(CONSULTATION_FETCH_LIMIT);
  if (ce) throw new Error(ce.message);

  const consultationRows = (consultRaw ?? []).map((row) => mapFiConsultationRow(row as Record<string, unknown>));

  const consultationBookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: window.rangeStartIso,
    rangeEndIso: window.rangeEndIso,
    bookingType: "consultation",
    includeCancelled: false,
    limit: BOARD_BOOKING_LIMIT,
  });

  const bookingById = new Map<string, FiBookingRow>();
  for (const b of consultationBookings) {
    bookingById.set(b.id, b);
  }

  const filteredConsultations = consultationRows.filter((r) => consultationInDateWindow(r, bookingById, window, nowMs));

  const consultBookingIds = uniqueIds(filteredConsultations.map((r) => r.booking_id));
  const orphanConsultationBookings = consultationBookings.filter((b) => isConsultationBooking(b) && !consultBookingIds.includes(b.id));

  const leadIds = uniqueIds([
    ...filteredConsultations.map((r) => r.lead_id),
    ...orphanConsultationBookings.map((b) => b.lead_id),
  ]);
  const patientIds = uniqueIds([
    ...filteredConsultations.map((r) => r.patient_id),
    ...orphanConsultationBookings.map((b) => b.patient_id),
  ]);
  const personIds = uniqueIds([...filteredConsultations.map((r) => r.person_id), ...orphanConsultationBookings.map((b) => b.person_id)]);

  const caseIds = uniqueIds(filteredConsultations.map((r) => r.case_id));

  const leadBundles = await loadLeadBundles(supabase, tid, leadIds);

  for (const lid of leadIds) {
    const b = leadBundles.get(lid);
    if (b?.leadPatientId) patientIds.push(b.leadPatientId);
    if (b?.leadCaseId) caseIds.push(b.leadCaseId);
    if (b?.leadPersonId) personIds.push(b.leadPersonId);
  }

  const [patientLabels, personLabels] = await Promise.all([
    loadPatientLabels(supabase, tid, uniqueIds(patientIds)),
    loadPersonLabels(supabase, tid, uniqueIds(personIds)),
  ]);
  const staffIdsFromConsult = uniqueIds(filteredConsultations.map((r) => r.consultant_staff_id));

  const staffIdsFromBookings = uniqueIds(orphanConsultationBookings.flatMap((b) => [b.assigned_staff_id]));
  const userIdsFromBookings = uniqueIds(orphanConsultationBookings.flatMap((b) => [b.assigned_user_id]));

  const stageIds = uniqueIds(Array.from(leadBundles.values()).map((v) => v.currentStageId));
  const [stageMeta, staffNames, userEmails, surgeryBookings, payByConsultation] = await Promise.all([
    loadStageMeta(supabase, tid, stageIds),
    loadStaffDisplayNames(supabase, tid, uniqueIds([...staffIdsFromConsult, ...staffIdsFromBookings])),
    loadUserEmails(supabase, tid, userIdsFromBookings),
    loadSurgeryBookingsForAnchors(supabase, tid, leadIds, uniqueIds(patientIds), caseIds, personIds),
    loadPaymentRecordsForConsultations(
      tid,
      filteredConsultations.map((r) => r.id)
    ),
  ]);

  const surgerySets = buildSurgeryPresenceSets(surgeryBookings);

  const base = `/fi-admin/${encodeURIComponent(tid)}`;

  const cards: ConsultationConversionBoardCard[] = [];

  const pushCard = (partial: Omit<ConsultationConversionBoardCard, "primaryColumn" | "nextAction"> & { primaryColumn: ConsultationConversionBoardColumnId }) => {
    cards.push({
      ...partial,
      nextAction: nextRecommendedAction(partial.primaryColumn),
    });
  };

  for (const row of filteredConsultations) {
    const leadId = row.lead_id?.trim() || null;
    const bundle = leadId ? leadBundles.get(leadId) ?? null : null;
    const stageId = bundle?.currentStageId?.trim() || null;
    const stMeta = stageId ? stageMeta.get(stageId) ?? null : null;
    const stageIsLost = Boolean(stMeta?.isLost);
    const leadStatusLost = bundle?.leadStatus?.trim().toLowerCase() === "lost";
    const crmLost = isCrmLostSignal({ stageIsLost, leadStatusLost });

    const quoteRaw = row.quote_data?.quote_status;
    const quoteNormalized = normalizeQuoteStatusFromSignals({
      consultationStatus: row.status,
      quoteStatusRaw: typeof quoteRaw === "string" ? quoteRaw : null,
    });
    const quoteDraftContent = hasQuoteDraftSignals(row.quote_data) && quoteNormalized === "neutral";

    const surgeryBooked = hasSurgeryBookedSignal({
      caseId: row.case_id,
      hasLinkedSurgeryBooking: resolveSurgeryLinked(surgerySets, {
        leadId,
        patientId: row.patient_id,
        personId: row.person_id,
        caseId: row.case_id,
        leadCaseId: bundle?.leadCaseId ?? null,
        leadPatientId: bundle?.leadPatientId ?? null,
        leadPersonId: bundle?.leadPersonId ?? null,
      }),
      consultationStatus: row.status,
    });

    const bookingRow = row.booking_id?.trim() ? bookingById.get(row.booking_id.trim()) ?? null : null;
    const bookingCompletedOrPast = bookingRow
      ? bookingRow.booking_status.trim().toLowerCase() === "completed" || Date.parse(bookingRow.start_at) < nowMs
      : false;

    const primaryColumn = pickConsultationConversionColumn({
      crmLost,
      consultationArchived: isConsultationArchivedSignal(row.archived_at),
      surgeryBooked,
      quoteNormalized,
      quoteDraftContent,
      consultationStatus: row.status,
      isBookingOnly: false,
      bookingCompletedOrPast,
    });

    const pid = row.patient_id?.trim();
    const perId = row.person_id?.trim();
    const patientName = pid ? patientLabels.get(pid) ?? null : null;
    const personName = perId ? personLabels.get(perId) ?? null : null;
    const leadName = leadId ? leadTitleFromRow(bundle?.leadSummary ?? null, leadId) : null;
    const patientOrLeadLabel = patientName ?? personName ?? leadName ?? "Unlinked";

    const staffName = row.consultant_staff_id?.trim() ? staffNames.get(row.consultant_staff_id.trim()) ?? null : null;
    const consultantLabel = resolveConsultationConsultantDisplayName({
      consultant_staff_id: row.consultant_staff_id,
      consultant_name: row.consultant_name,
      linkedStaffName: staffName,
    });

    const consultationDateYmd =
      row.consultation_date?.trim() ||
      (bookingRow ? calendarYmdFromIsoInstant(bookingRow.start_at, window.calendarTimezone) : null);
    const consultationDateLabel = consultationDateYmd ?? "—";
    const daysSince = daysSinceCalendarYmd(consultationDateYmd, window.todayYmd);

    const quoteStatusDisplay =
      typeof quoteRaw === "string" && quoteRaw.trim()
        ? quoteRaw.trim()
        : row.status === "quoted"
          ? "Quoted (status)"
          : null;

    const graftOrTreatmentLine = formatGraftLine(row.quote_data, row.consultation_type);

    const leadStageLabel = stMeta?.label ?? null;

    const effectiveCaseId = row.case_id?.trim() || bundle?.leadCaseId?.trim() || null;

    const depositBoardLine =
      CONSULTATION_DEPOSIT_BOARD_COPY[
        consultationDepositBoardLabel(payByConsultation.get(row.id) ?? null, window.todayYmd)
      ];

    pushCard({
      id: `consult:${row.id}`,
      consultationId: row.id,
      bookingId: row.booking_id?.trim() || null,
      primaryColumn,
      patientOrLeadLabel,
      consultantLabel,
      consultationDateYmd,
      consultationDateLabel,
      daysSinceConsultation: daysSince,
      quoteStatusDisplay,
      graftOrTreatmentLine,
      leadStageLabel,
      caseId: effectiveCaseId,
      caseLabel: effectiveCaseId ? "Case linked" : null,
      depositBoardLine,
      hrefs: {
        consultation: `${base}/consultations/${encodeURIComponent(row.id)}`,
        lead: leadId ? `${base}/crm/leads/${encodeURIComponent(leadId)}` : null,
        patient: pid ? `${base}/patients/${encodeURIComponent(pid)}` : null,
        case: effectiveCaseId ? `${base}/cases/${encodeURIComponent(effectiveCaseId)}` : null,
        appointment: row.booking_id?.trim() ? `${base}/appointments/${encodeURIComponent(row.booking_id.trim())}` : null,
      },
    });
  }

  for (const b of orphanConsultationBookings) {
    const leadId = b.lead_id?.trim() || null;
    const bundle = leadId ? leadBundles.get(leadId) ?? null : null;
    const stageId = bundle?.currentStageId?.trim() || null;
    const stMeta = stageId ? stageMeta.get(stageId) ?? null : null;
    const stageIsLost = Boolean(stMeta?.isLost);
    const leadStatusLost = bundle?.leadStatus?.trim().toLowerCase() === "lost";
    const crmLost = isCrmLostSignal({ stageIsLost, leadStatusLost });

    const surgeryBooked = hasSurgeryBookedSignal({
      caseId: b.case_id,
      hasLinkedSurgeryBooking: resolveSurgeryLinked(surgerySets, {
        leadId,
        patientId: b.patient_id,
        personId: b.person_id,
        caseId: b.case_id,
        leadCaseId: bundle?.leadCaseId ?? null,
        leadPatientId: bundle?.leadPatientId ?? null,
        leadPersonId: bundle?.leadPersonId ?? null,
      }),
      consultationStatus: "",
    });

    const bookingCompletedOrPast =
      b.booking_status.trim().toLowerCase() === "completed" || Date.parse(b.start_at) < nowMs;

    const primaryColumn = pickConsultationConversionColumn({
      crmLost,
      consultationArchived: false,
      surgeryBooked,
      quoteNormalized: "neutral",
      quoteDraftContent: false,
      consultationStatus: "draft",
      isBookingOnly: true,
      bookingCompletedOrPast,
    });

    const pid = b.patient_id?.trim();
    const perId = b.person_id?.trim();
    const patientName = pid ? patientLabels.get(pid) ?? null : null;
    const personName = perId ? personLabels.get(perId) ?? null : null;
    const leadName = leadId ? leadTitleFromRow(bundle?.leadSummary ?? null, leadId) : null;
    const title = b.title?.trim();
    const patientOrLeadLabel = patientName ?? personName ?? leadName ?? title ?? "Consultation booking";

    let assignee: string | null = null;
    if (b.assigned_staff_id?.trim()) assignee = staffNames.get(b.assigned_staff_id.trim()) ?? null;
    if (!assignee && b.assigned_user_id?.trim()) assignee = userEmails.get(b.assigned_user_id.trim()) ?? null;

    const consultationDateYmd = calendarYmdFromIsoInstant(b.start_at, window.calendarTimezone);
    const consultationDateLabel = consultationDateYmd ?? "—";
    const daysSince = daysSinceCalendarYmd(consultationDateYmd, window.todayYmd);

    const effectiveCaseId = b.case_id?.trim() || bundle?.leadCaseId?.trim() || null;

    pushCard({
      id: `booking:${b.id}`,
      consultationId: null,
      bookingId: b.id,
      primaryColumn,
      patientOrLeadLabel,
      consultantLabel: assignee,
      consultationDateYmd,
      consultationDateLabel,
      daysSinceConsultation: daysSince,
      quoteStatusDisplay: null,
      graftOrTreatmentLine: null,
      leadStageLabel: stMeta?.label ?? null,
      caseId: effectiveCaseId,
      caseLabel: effectiveCaseId ? "Case linked" : null,
      depositBoardLine: CONSULTATION_DEPOSIT_BOARD_COPY.no_tracking,
      hrefs: {
        consultation: null,
        lead: leadId ? `${base}/crm/leads/${encodeURIComponent(leadId)}` : null,
        patient: pid ? `${base}/patients/${encodeURIComponent(pid)}` : null,
        case: effectiveCaseId ? `${base}/cases/${encodeURIComponent(effectiveCaseId)}` : null,
        appointment: `${base}/appointments/${encodeURIComponent(b.id)}`,
      },
    });
  }

  const columns: Record<ConsultationConversionBoardColumnId, ConsultationConversionBoardCard[]> = {
    consultation_booked: [],
    consultation_completed: [],
    quote_drafted: [],
    quote_sent: [],
    quote_accepted: [],
    surgery_booked: [],
    lost: [],
  };

  for (const c of cards) {
    columns[c.primaryColumn].push(c);
  }

  const sortFn = (a: ConsultationConversionBoardCard, b: ConsultationConversionBoardCard) => {
    const da = a.consultationDateYmd ?? "";
    const db = b.consultationDateYmd ?? "";
    return db.localeCompare(da) || a.patientOrLeadLabel.localeCompare(b.patientOrLeadLabel);
  };
  for (const k of Object.keys(columns) as ConsultationConversionBoardColumnId[]) {
    columns[k].sort(sortFn);
  }

  const columnCounts = {
    consultation_booked: columns.consultation_booked.length,
    consultation_completed: columns.consultation_completed.length,
    quote_drafted: columns.quote_drafted.length,
    quote_sent: columns.quote_sent.length,
    quote_accepted: columns.quote_accepted.length,
    surgery_booked: columns.surgery_booked.length,
    lost: columns.lost.length,
  };

  const consultationBookingYmdsNextRange = consultationBookings.map((bk) =>
    calendarYmdFromIsoInstant(bk.start_at, window.calendarTimezone)
  ).filter((x): x is string => Boolean(x));

  const kpis = aggregateConsultationConversionKpis({
    calendarTimezone: window.calendarTimezone,
    consultationBookingStartsNext30: consultationBookingYmdsNextRange,
    todayYmd: window.todayYmd,
    completedConsultationDatesLast30: filteredConsultations.map((r) => ({
      consultationDateYmd: r.consultation_date?.trim() ?? null,
      status: r.status,
    })),
    columnCounts,
  });

  return { window, columns, kpis };
}
