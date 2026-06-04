import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import type { PatientDirectoryQuery } from "./patientDirectoryQuery";
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
  latestBookingAt: string | null;
  activeCaseCount: number;
  linkedLeadCount: number;
};

export type PatientDirectoryPageResult = {
  rows: PatientDirectoryRow[];
  total: number;
  query: PatientDirectoryQuery;
};

function personMetaContact(meta: Record<string, unknown>): { email: string | null; phone: string | null } {
  const email =
    typeof meta.email === "string"
      ? meta.email.trim() || null
      : typeof meta.email_normalized === "string"
        ? meta.email_normalized.trim() || null
        : null;
  const phone = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  return { email, phone };
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function loadPersonIdsMatchingSearch(
  supabase: SupabaseClient,
  tenantId: string,
  search: string
): Promise<string[] | null> {
  const term = search.trim();
  if (!term) return null;
  const p = `%${escapeIlikePattern(term)}%`;
  const { data, error } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("tenant_id", tenantId)
    .filter("metadata::text", "ilike", p)
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

  const personFilter = await loadPersonIdsMatchingSearch(supabase, tid, query.search);
  if (query.search.trim() && (!personFilter || personFilter.length === 0)) {
    return { rows: [], total: 0, query };
  }

  let restrictPatientIds: string[] | null = null;

  if (query.hasActiveCase === true) {
    restrictPatientIds = intersectSets(restrictPatientIds, await loadPatientIdsWithActiveCases(supabase, tid));
  }
  if (query.hasFutureBooking === true) {
    restrictPatientIds = intersectSets(restrictPatientIds, await loadPatientIdsWithFutureBookings(supabase, tid, nowIso));
  }

  if (restrictPatientIds && restrictPatientIds.length === 0) {
    return { rows: [], total: 0, query };
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
    return { rows: [], total: count ?? 0, query };
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

  const [{ data: caseRows }, { data: leadRows }, { data: bookRows }] = await Promise.all([
    supabase
      .from("fi_cases")
      .select("foundation_patient_id, status")
      .eq("tenant_id", tid)
      .in("foundation_patient_id", patientIds),
    supabase.from("fi_crm_leads").select("id, patient_id").eq("tenant_id", tid).in("patient_id", patientIds),
    supabase.from("fi_bookings").select("patient_id, start_at").eq("tenant_id", tid).in("patient_id", patientIds),
  ]);

  const activeCaseByPatient = new Map<string, number>();
  for (const row of caseRows ?? []) {
    const pid = (row as { foundation_patient_id: string | null }).foundation_patient_id;
    const st = (row as { status: string }).status;
    if (!pid || !isActiveCaseStatus(st)) continue;
    activeCaseByPatient.set(String(pid), (activeCaseByPatient.get(String(pid)) ?? 0) + 1);
  }

  const leadCountByPatient = new Map<string, number>();
  for (const row of leadRows ?? []) {
    const pid = (row as { patient_id: string | null }).patient_id;
    if (!pid) continue;
    leadCountByPatient.set(String(pid), (leadCountByPatient.get(String(pid)) ?? 0) + 1);
  }

  const latestBookingByPatient = new Map<string, string>();
  for (const row of bookRows ?? []) {
    const pid = (row as { patient_id: string | null }).patient_id;
    const startAt = String((row as { start_at: string }).start_at);
    if (!pid) continue;
    const cur = latestBookingByPatient.get(String(pid));
    if (!cur || Date.parse(startAt) > Date.parse(cur)) latestBookingByPatient.set(String(pid), startAt);
  }

  const rows: PatientDirectoryRow[] = (patRows ?? []).map((raw) => {
    const r = raw as {
      id: string;
      person_id: string;
      created_at: string;
      patient_status?: string | null;
    };
    const meta = personMeta.get(String(r.person_id)) ?? {};
    const { email, phone } = personMetaContact(meta);
    const displayName = personMetadataDisplayLabel(meta);
    const pid = String(r.id);
    return {
      patientId: pid,
      personId: String(r.person_id),
      displayName,
      email,
      phone,
      patientStatus: normalizePatientStatus(r.patient_status),
      createdAt: String(r.created_at),
      latestBookingAt: latestBookingByPatient.get(pid) ?? null,
      activeCaseCount: activeCaseByPatient.get(pid) ?? 0,
      linkedLeadCount: leadCountByPatient.get(pid) ?? 0,
    };
  });

  return { rows, total: count ?? rows.length, query };
}

function uniqueStrings(ids: string[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id) s.add(id);
  }
  return Array.from(s);
}
