import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import {
  buildFiPersonsMetadataSearchOrFilter,
  patientDirectorySearchIlikePattern,
} from "@/src/lib/patients/patientDirectorySearch";
import type { PatientDirectoryQuery } from "./patientDirectoryQuery";
import { norwoodValuesInRange } from "./patientDirectoryQuery";
import { formatClinicalScalesSummary } from "./hairLossScales";
import {
  countCompletedProcedures,
  pickLastVisitAt,
  pickNextAppointment,
  sumPatientLifetimeValueGbp,
  type PatientDirectoryBookingLike,
} from "./patientDirectoryMetrics";
import { isActiveCaseStatus } from "./patientProfileSummary";
import { normalizePatientStatus, type PatientStatusValue } from "./patientPolicy";

export type PatientDirectoryRow = {
  patientId: string;
  personId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  patientStatus: PatientStatusValue;
  createdAt: string;
  /** Full Norwood / Ludwig / pattern summary line. */
  clinicalScalesSummary: string | null;
  norwoodScale: string | null;
  nextAppointmentAt: string | null;
  nextAppointmentId: string | null;
  nextAppointmentTitle: string | null;
  lastVisitAt: string | null;
  totalProcedures: number;
  lifetimeValueGbp: number | null;
  primaryLeadSource: string | null;
  activeCaseCount: number;
  linkedLeadCount: number;
};

export type PatientDirectorySummary = {
  totalPatients: number;
  activePatients: number;
  withActiveCase: number;
  withFutureBooking: number;
};

export type PatientDirectoryPageResult = {
  rows: PatientDirectoryRow[];
  total: number;
  query: PatientDirectoryQuery;
  summary: PatientDirectorySummary;
  leadSourceOptions: string[];
};

async function loadPersonIdsMatchingSearch(
  supabase: SupabaseClient,
  tenantId: string,
  search: string
): Promise<string[] | null> {
  const term = search.trim();
  if (!term) return null;
  const quotedPattern = patientDirectorySearchIlikePattern(term);
  const orFilter = buildFiPersonsMetadataSearchOrFilter(quotedPattern);
  const { data, error } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(orFilter)
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String((r as { id: string }).id));
}

async function loadPatientIdsWithActiveCases(supabase: SupabaseClient, tenantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("foundation_patient_id, status")
    .eq("tenant_id", tenantId)
    .not("foundation_patient_id", "is", null);
  if (error) throw new Error(error.message);
  const out = new Set<string>();
  for (const row of data ?? []) {
    const pid = (row as { foundation_patient_id: string | null }).foundation_patient_id;
    const st = (row as { status: string }).status;
    if (pid && isActiveCaseStatus(st)) out.add(String(pid));
  }
  return Array.from(out);
}

async function loadPatientIdsWithFutureBookings(supabase: SupabaseClient, tenantId: string, nowIso: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("patient_id, start_at, booking_status")
    .eq("tenant_id", tenantId)
    .not("patient_id", "is", null)
    .gte("start_at", nowIso);
  if (error) throw new Error(error.message);
  const out = new Set<string>();
  for (const row of data ?? []) {
    const st = String((row as { booking_status: string }).booking_status ?? "").toLowerCase();
    if (st === "cancelled" || st === "completed" || st === "no_show") continue;
    const pid = (row as { patient_id: string | null }).patient_id;
    if (pid) out.add(String(pid));
  }
  return Array.from(out);
}

function intersectSets(a: string[] | null, b: string[] | null): string[] | null {
  if (!a) return b;
  if (!b) return a;
  const sb = new Set(b);
  return a.filter((x) => sb.has(x));
}

async function loadPatientIdsInNorwoodRange(
  supabase: SupabaseClient,
  tenantId: string,
  query: PatientDirectoryQuery
): Promise<string[] | null> {
  const scales = norwoodValuesInRange(query.norwoodMin, query.norwoodMax);
  if (!scales) return null;
  if (scales.length === 0) return [];
  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .in("norwood_scale", scales);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String((r as { patient_id: string }).patient_id));
}

async function loadPatientIdsWithLastVisitInRange(
  supabase: SupabaseClient,
  tenantId: string,
  query: PatientDirectoryQuery
): Promise<string[] | null> {
  if (!query.lastVisitFrom && !query.lastVisitTo) return null;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("patient_id, start_at, booking_status, booking_type, id, title")
    .eq("tenant_id", tenantId)
    .not("patient_id", "is", null);
  if (error) throw new Error(error.message);
  const bookingsByPatient = new Map<string, PatientDirectoryBookingLike[]>();
  for (const row of data ?? []) {
    const pid = (row as { patient_id: string | null }).patient_id;
    if (!pid) continue;
    const pidStr = String(pid);
    const list = bookingsByPatient.get(pidStr) ?? [];
    list.push({
      id: String((row as { id: string }).id),
      start_at: String((row as { start_at: string }).start_at),
      booking_status: String((row as { booking_status: string }).booking_status),
      booking_type: String((row as { booking_type: string }).booking_type),
      title: (row as { title: string | null }).title,
    });
    bookingsByPatient.set(pidStr, list);
  }
  const fromMs = query.lastVisitFrom ? Date.parse(query.lastVisitFrom) : null;
  const toMs = query.lastVisitTo ? Date.parse(query.lastVisitTo) : null;
  const out: string[] = [];
  for (const [pid, bookings] of Array.from(bookingsByPatient.entries())) {
    const lastVisit = pickLastVisitAt(bookings, nowIso);
    if (!lastVisit) continue;
    const t = Date.parse(lastVisit);
    if (fromMs != null && t < fromMs) continue;
    if (toMs != null && t > toMs) continue;
    out.push(pid);
  }
  return out;
}

async function loadPatientIdsWithLeadSource(
  supabase: SupabaseClient,
  tenantId: string,
  leadSource: string
): Promise<string[]> {
  const src = leadSource.trim();
  if (!src) return [];
  const out = new Set<string>();

  const { data: mapRows, error: mapErr } = await supabase
    .from("fi_crm_lead_source_ids")
    .select("lead_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", src);
  if (mapErr) throw new Error(mapErr.message);
  const leadIds = uniqueStrings((mapRows ?? []).map((r) => String((r as { lead_id: string }).lead_id)));
  if (leadIds.length) {
    const { data: leads, error: le } = await supabase
      .from("fi_crm_leads")
      .select("patient_id")
      .eq("tenant_id", tenantId)
      .in("id", leadIds)
      .not("patient_id", "is", null);
    if (le) throw new Error(le.message);
    for (const row of leads ?? []) {
      const pid = (row as { patient_id: string | null }).patient_id;
      if (pid) out.add(String(pid));
    }
  }

  const { data: metaLeads, error: me } = await supabase
    .from("fi_crm_leads")
    .select("patient_id, metadata")
    .eq("tenant_id", tenantId)
    .not("patient_id", "is", null);
  if (me) throw new Error(me.message);
  for (const row of metaLeads ?? []) {
    const meta = (row as { metadata: unknown }).metadata;
    const m =
      meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
    const sys =
      typeof m.source_system === "string"
        ? m.source_system.trim()
        : typeof m.crm_source_system === "string"
          ? m.crm_source_system.trim()
          : "";
    if (sys === src) {
      const pid = (row as { patient_id: string | null }).patient_id;
      if (pid) out.add(String(pid));
    }
  }

  return Array.from(out);
}

export async function loadPatientDirectoryLeadSourceOptions(tenantId: string, client?: SupabaseClient): Promise<string[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const { data, error } = await supabase
    .from("fi_crm_lead_source_ids")
    .select("source_system")
    .eq("tenant_id", tid)
    .order("source_system", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data ?? []) {
    const s = String((row as { source_system: string }).source_system).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export async function loadPatientDirectorySummary(
  tenantId: string,
  client?: SupabaseClient
): Promise<PatientDirectorySummary> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const nowIso = new Date().toISOString();

  const [{ count: total }, { count: active }, activeCaseIds, futureBookingIds] = await Promise.all([
    supabase.from("fi_patients").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
    supabase
      .from("fi_patients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("patient_status", "active"),
    loadPatientIdsWithActiveCases(supabase, tid),
    loadPatientIdsWithFutureBookings(supabase, tid, nowIso),
  ]);

  return {
    totalPatients: total ?? 0,
    activePatients: active ?? 0,
    withActiveCase: activeCaseIds.length,
    withFutureBooking: futureBookingIds.length,
  };
}

const MAX_IDS_IN_NOT_IN = 180;

function applyPatientIdNotIn(query: { not: (col: string, op: string, val: string) => unknown }, ids: string[]): unknown {
  if (!ids.length) return query;
  const slice = ids.slice(0, MAX_IDS_IN_NOT_IN);
  return query.not("id", "in", `(${slice.join(",")})`);
}

export async function loadPatientDirectoryPage(
  tenantId: string,
  query: PatientDirectoryQuery,
  client?: SupabaseClient
): Promise<PatientDirectoryPageResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const nowIso = new Date().toISOString();

  const [summary, leadSourceOptions] = await Promise.all([
    loadPatientDirectorySummary(tid, supabase),
    loadPatientDirectoryLeadSourceOptions(tid, supabase),
  ]);

  const emptyResult = (): PatientDirectoryPageResult => ({
    rows: [],
    total: 0,
    query,
    summary,
    leadSourceOptions,
  });

  const personFilter = await loadPersonIdsMatchingSearch(supabase, tid, query.search);
  if (query.search.trim() && (!personFilter || personFilter.length === 0)) {
    return emptyResult();
  }

  let restrictPatientIds: string[] | null = null;

  if (query.hasActiveCase === true) {
    restrictPatientIds = intersectSets(restrictPatientIds, await loadPatientIdsWithActiveCases(supabase, tid));
  }
  if (query.hasFutureBooking === true) {
    restrictPatientIds = intersectSets(restrictPatientIds, await loadPatientIdsWithFutureBookings(supabase, tid, nowIso));
  }
  if (query.norwoodMin || query.norwoodMax) {
    restrictPatientIds = intersectSets(restrictPatientIds, await loadPatientIdsInNorwoodRange(supabase, tid, query));
  }
  if (query.lastVisitFrom || query.lastVisitTo) {
    restrictPatientIds = intersectSets(
      restrictPatientIds,
      await loadPatientIdsWithLastVisitInRange(supabase, tid, query)
    );
  }
  if (query.leadSource) {
    restrictPatientIds = intersectSets(
      restrictPatientIds,
      await loadPatientIdsWithLeadSource(supabase, tid, query.leadSource)
    );
  }

  if (restrictPatientIds && restrictPatientIds.length === 0) {
    return emptyResult();
  }

  const excludeActiveCase = query.hasActiveCase === false ? await loadPatientIdsWithActiveCases(supabase, tid) : [];
  const excludeFutureBooking =
    query.hasFutureBooking === false ? await loadPatientIdsWithFutureBookings(supabase, tid, nowIso) : [];

  const ascending = query.sort === "created_asc";
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let listQuery = supabase
    .from("fi_patients")
    .select("id, person_id, created_at, admin_note, patient_status, metadata", { count: "exact" })
    .eq("tenant_id", tid);

  if (query.patientStatus) {
    listQuery = listQuery.eq("patient_status", query.patientStatus);
  }
  if (personFilter) {
    listQuery = listQuery.in("person_id", personFilter);
  }
  if (restrictPatientIds) {
    listQuery = listQuery.in("id", restrictPatientIds);
  }
  if (excludeActiveCase.length) {
    listQuery = applyPatientIdNotIn(listQuery, excludeActiveCase) as typeof listQuery;
  }
  if (excludeFutureBooking.length) {
    listQuery = applyPatientIdNotIn(listQuery, excludeFutureBooking) as typeof listQuery;
  }

  listQuery = listQuery.order("created_at", { ascending }).range(from, to);

  const { data: patRows, error: listErr, count } = await listQuery;
  if (listErr) throw new Error(listErr.message);

  const patientIds = (patRows ?? []).map((r) => String((r as { id: string }).id));
  if (patientIds.length === 0) {
    return { rows: [], total: count ?? 0, query, summary, leadSourceOptions };
  }

  const personIds = uniqueStrings((patRows ?? []).map((r) => String((r as { person_id: string }).person_id)));

  const { data: personRows, error: pe } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .in("id", personIds);
  if (pe) throw new Error(pe.message);

  const personMeta = new Map<string, Record<string, unknown>>();
  for (const row of personRows ?? []) {
    const id = String((row as { id: string }).id);
    const m = (row as { metadata: unknown }).metadata;
    personMeta.set(
      id,
      m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {}
    );
  }

  const [{ data: caseRows }, { data: leadRows }, { data: bookRows }, { data: clinicalRows }] = await Promise.all([
    supabase
      .from("fi_cases")
      .select("foundation_patient_id, status")
      .eq("tenant_id", tid)
      .in("foundation_patient_id", patientIds),
    supabase.from("fi_crm_leads").select("id, patient_id, metadata").eq("tenant_id", tid).in("patient_id", patientIds),
    supabase
      .from("fi_bookings")
      .select("id, patient_id, start_at, booking_status, booking_type, title")
      .eq("tenant_id", tid)
      .in("patient_id", patientIds),
    supabase
      .from("fi_patient_clinical_details")
      .select("patient_id, norwood_scale, ludwig_scale, hairline_pattern, primary_concern, primary_hair_concern")
      .eq("tenant_id", tid)
      .in("patient_id", patientIds),
  ]);

  const pageLeadIds = uniqueStrings((leadRows ?? []).map((r) => String((r as { id: string }).id)));
  const leadSourceByLeadId = new Map<string, string>();
  if (pageLeadIds.length) {
    const { data: leadSourceRows, error: lsErr } = await supabase
      .from("fi_crm_lead_source_ids")
      .select("lead_id, source_system")
      .eq("tenant_id", tid)
      .in("lead_id", pageLeadIds);
    if (lsErr) throw new Error(lsErr.message);
    for (const row of leadSourceRows ?? []) {
      leadSourceByLeadId.set(
        String((row as { lead_id: string }).lead_id),
        String((row as { source_system: string }).source_system)
      );
    }
  }

  const activeCaseByPatient = new Map<string, number>();
  for (const row of caseRows ?? []) {
    const pid = (row as { foundation_patient_id: string | null }).foundation_patient_id;
    const st = (row as { status: string }).status;
    if (!pid || !isActiveCaseStatus(st)) continue;
    activeCaseByPatient.set(String(pid), (activeCaseByPatient.get(String(pid)) ?? 0) + 1);
  }

  const leadCountByPatient = new Map<string, number>();
  const leadSourceByPatient = new Map<string, string>();
  const leadMetasByPatient = new Map<string, Record<string, unknown>[]>();
  for (const row of leadRows ?? []) {
    const pid = (row as { patient_id: string | null }).patient_id;
    if (!pid) continue;
    const pidStr = String(pid);
    leadCountByPatient.set(pidStr, (leadCountByPatient.get(pidStr) ?? 0) + 1);
    const meta = (row as { metadata: unknown }).metadata;
    const metaObj =
      meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
    const metas = leadMetasByPatient.get(pidStr) ?? [];
    metas.push(metaObj);
    leadMetasByPatient.set(pidStr, metas);
    if (!leadSourceByPatient.has(pidStr)) {
      const leadId = String((row as { id: string }).id);
      const mapped = leadSourceByLeadId.get(leadId);
      if (mapped) {
        leadSourceByPatient.set(pidStr, mapped);
      } else {
        const sys =
          typeof metaObj.source_system === "string"
            ? metaObj.source_system.trim()
            : typeof metaObj.crm_source_system === "string"
              ? metaObj.crm_source_system.trim()
              : "";
        if (sys) leadSourceByPatient.set(pidStr, sys);
      }
    }
  }

  const bookingsByPatient = new Map<string, PatientDirectoryBookingLike[]>();
  for (const row of bookRows ?? []) {
    const pid = (row as { patient_id: string | null }).patient_id;
    if (!pid) continue;
    const pidStr = String(pid);
    const list = bookingsByPatient.get(pidStr) ?? [];
    list.push({
      id: String((row as { id: string }).id),
      start_at: String((row as { start_at: string }).start_at),
      booking_status: String((row as { booking_status: string }).booking_status),
      booking_type: String((row as { booking_type: string }).booking_type),
      title: (row as { title: string | null }).title,
    });
    bookingsByPatient.set(pidStr, list);
  }

  const clinicalByPatient = new Map<
    string,
    {
      norwood_scale: string | null;
      ludwig_scale: string | null;
      hairline_pattern: string | null;
      primary_concern: string | null;
      primary_hair_concern: string | null;
    }
  >();
  for (const row of clinicalRows ?? []) {
    const pid = String((row as { patient_id: string }).patient_id);
    const r = row as Record<string, unknown>;
    clinicalByPatient.set(pid, {
      norwood_scale: r.norwood_scale != null ? String(r.norwood_scale) : null,
      ludwig_scale: r.ludwig_scale != null ? String(r.ludwig_scale) : null,
      hairline_pattern: r.hairline_pattern != null ? String(r.hairline_pattern) : null,
      primary_concern: r.primary_concern != null ? String(r.primary_concern) : null,
      primary_hair_concern: r.primary_hair_concern != null ? String(r.primary_hair_concern) : null,
    });
  }

  const rows: PatientDirectoryRow[] = (patRows ?? []).map((raw) => {
    const r = raw as {
      id: string;
      person_id: string;
      created_at: string;
      patient_status?: string | null;
      metadata?: unknown;
    };
    const meta = personMeta.get(String(r.person_id)) ?? {};
    const patMeta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : {};
    const idc = derivePatientIdentityContact({ personMetadata: meta, patientMetadata: patMeta });
    const displayName = idc.fullName;
    const email = idc.primaryEmail;
    const phone = idc.primaryPhone;
    const pid = String(r.id);
    const clinical = clinicalByPatient.get(pid);
    const norwoodScale = clinical?.norwood_scale ?? null;
    const clinicalScalesSummary = clinical
      ? formatClinicalScalesSummary({
          norwood_scale: clinical.norwood_scale,
          ludwig_scale: clinical.ludwig_scale,
          hairline_pattern: clinical.hairline_pattern,
          primary_concern: clinical.primary_concern ?? clinical.primary_hair_concern,
        })
      : null;
    const patientBookings = bookingsByPatient.get(pid) ?? [];
    const nextAppt = pickNextAppointment(patientBookings, nowIso);
    return {
      patientId: pid,
      personId: String(r.person_id),
      displayName,
      email,
      phone,
      patientStatus: normalizePatientStatus(r.patient_status),
      createdAt: String(r.created_at),
      clinicalScalesSummary,
      norwoodScale,
      nextAppointmentAt: nextAppt?.startAt ?? null,
      nextAppointmentId: nextAppt?.id ?? null,
      nextAppointmentTitle: nextAppt?.title ?? null,
      lastVisitAt: pickLastVisitAt(patientBookings, nowIso),
      totalProcedures: countCompletedProcedures(patientBookings),
      lifetimeValueGbp: sumPatientLifetimeValueGbp(leadMetasByPatient.get(pid) ?? []),
      primaryLeadSource: leadSourceByPatient.get(pid) ?? null,
      activeCaseCount: activeCaseByPatient.get(pid) ?? 0,
      linkedLeadCount: leadCountByPatient.get(pid) ?? 0,
    };
  });

  return { rows, total: count ?? rows.length, query, summary, leadSourceOptions };
}

function uniqueStrings(ids: string[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id) s.add(id);
  }
  return Array.from(s);
}
