/**
 * Stage 1G — tenant-scoped foundation integrity metrics (read-only).
 * Uses v_fi_patient_resolution, v_fi_case_foundation, v_fi_media_unified where noted.
 * Intended for service-role / internal admin APIs only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FoundationSupabase } from "./types";

const CHUNK = 400;

export type UnresolvedGlobalPatientPreview = {
  global_patient_id: string;
  source_system: string;
  source_patient_id: string;
};

export type UnresolvedCasePreview = {
  case_id: string;
  global_case_id: string | null;
  global_patient_id: string | null;
  status: string;
  source_system: string | null;
  source_case_id: string | null;
};

export type DuplicatePersonEmailPreview = {
  email_normalized: string;
  person_count: number;
  person_ids: string[];
};

export type FoundationIntegrityMetrics = {
  tenant_id: string;
  totals: {
    fi_events: number;
    fi_events_processed: number;
    fi_persons: number;
    fi_patients: number;
    fi_cases: number;
    fi_cases_with_foundation_patient_id: number;
    fi_timeline_events: number;
    fi_media_assets: number;
  };
  coverage: {
    /** Distinct fi_events with at least one fi_event_links row where fi_case_id is set (latest link wins). */
    events_with_fi_case_link: number;
    /** Distinct events whose latest linked fi_cases row has foundation_patient_id. */
    events_with_foundation_patient_on_linked_case: number;
    /** Distinct events whose linked case’s foundation patient has person_id. */
    events_with_person_on_linked_foundation_patient: number;
  };
  risks: {
    unresolved_global_patients: number;
    unresolved_cases_no_foundation_patient: number;
    duplicate_person_email_normalized_groups: number;
    duplicate_patient_rows_same_person_id: number;
    fi_media_assets_without_case_id: number;
    fi_timeline_events_detail_empty_or_null: number;
  };
  previews: {
    unresolved_global_patients: UnresolvedGlobalPatientPreview[];
    unresolved_cases: UnresolvedCasePreview[];
    duplicate_person_emails: DuplicatePersonEmailPreview[];
  };
  unified_media_without_case_id: number;
  notes: string[];
};

function readEmailNormalized(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const v = (metadata as Record<string, unknown>).email_normalized;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function loadTenantEventIds(supabase: SupabaseClient, tenantId: string): Promise<string[]> {
  const out: string[] = [];
  const pageSize = 1000;
  let from = 0;
  const maxRows = 200_000;
  for (;;) {
    const { data, error } = await supabase
      .from("fi_events")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as { id: string }[];
    for (const row of batch) out.push(row.id);
    if (batch.length < pageSize) break;
    from += pageSize;
    if (from >= maxRows) break;
  }
  return out;
}

async function buildEventToCaseMap(
  supabase: SupabaseClient,
  tenantEventIds: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (let i = 0; i < tenantEventIds.length; i += CHUNK) {
    const slice = tenantEventIds.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("fi_event_links")
      .select("event_id, fi_case_id, created_at")
      .in("event_id", slice)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const eventId = String((row as { event_id: string }).event_id);
      if (out.has(eventId)) continue;
      out.set(eventId, (row as { fi_case_id: string | null }).fi_case_id);
    }
  }
  return out;
}

async function computeCoverageFromCaseMap(
  supabase: SupabaseClient,
  tenantId: string,
  tenantEventIds: string[],
  eventToCase: Map<string, string | null>
): Promise<{
  events_with_fi_case_link: number;
  events_with_foundation_patient_on_linked_case: number;
  events_with_person_on_linked_foundation_patient: number;
}> {
  let events_with_fi_case_link = 0;
  const caseIds = new Set<string>();
  for (const eid of tenantEventIds) {
    const caseId = eventToCase.get(eid) ?? null;
    if (caseId) {
      events_with_fi_case_link += 1;
      caseIds.add(caseId);
    }
  }

  const foundationByCase = new Map<string, { foundation_patient_id: string | null; person_id: string | null }>();
  const caseIdList = Array.from(caseIds);
  for (let i = 0; i < caseIdList.length; i += CHUNK) {
    const slice = caseIdList.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("fi_cases")
      .select("id, foundation_patient_id")
      .eq("tenant_id", tenantId)
      .in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      foundationByCase.set(String((row as { id: string }).id), {
        foundation_patient_id: (row as { foundation_patient_id: string | null }).foundation_patient_id,
        person_id: null,
      });
    }
  }

  const patientIds = new Set<string>();
  for (const v of Array.from(foundationByCase.values())) {
    if (v.foundation_patient_id) patientIds.add(v.foundation_patient_id);
  }
  const pidList = Array.from(patientIds);
  const personByPatient = new Map<string, string>();
  for (let j = 0; j < pidList.length; j += CHUNK) {
    const ps = pidList.slice(j, j + CHUNK);
    if (ps.length === 0) continue;
    const pr = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .in("id", ps);
    if (pr.error) throw new Error(pr.error.message);
    for (const p of pr.data ?? []) {
      personByPatient.set(String((p as { id: string }).id), String((p as { person_id: string }).person_id));
    }
  }

  for (const [cid, v] of Array.from(foundationByCase.entries())) {
    const pid = v.foundation_patient_id;
    const personId = pid ? personByPatient.get(pid) ?? null : null;
    foundationByCase.set(cid, { foundation_patient_id: v.foundation_patient_id, person_id: personId });
  }

  let events_with_foundation_patient_on_linked_case = 0;
  let events_with_person_on_linked_foundation_patient = 0;
  for (const eid of tenantEventIds) {
    const caseId = eventToCase.get(eid) ?? null;
    if (!caseId) continue;
    const row = foundationByCase.get(caseId);
    if (!row) continue;
    if (row.foundation_patient_id) events_with_foundation_patient_on_linked_case += 1;
    if (row.person_id) events_with_person_on_linked_foundation_patient += 1;
  }

  return {
    events_with_fi_case_link,
    events_with_foundation_patient_on_linked_case,
    events_with_person_on_linked_foundation_patient,
  };
}

function isDetailEmpty(detail: unknown): boolean {
  if (detail == null) return true;
  if (typeof detail !== "object" || Array.isArray(detail)) return false;
  return Object.keys(detail as Record<string, unknown>).length === 0;
}

/**
 * Load foundation integrity metrics for one tenant.
 */
export async function loadFoundationIntegrityMetrics(
  tenantId: string,
  client?: FoundationSupabase
): Promise<FoundationIntegrityMetrics> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const notes: string[] = [];

  const { count: fi_events, error: e1 } = await supabase
    .from("fi_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (e1) throw new Error(e1.message);

  const { count: fi_events_processed, error: e2 } = await supabase
    .from("fi_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("status", "processed");
  if (e2) throw new Error(e2.message);

  const { count: fi_persons, error: e3 } = await supabase
    .from("fi_persons")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (e3) throw new Error(e3.message);

  const { count: fi_patients, error: e4 } = await supabase
    .from("fi_patients")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (e4) throw new Error(e4.message);

  const { count: fi_cases, error: e5 } = await supabase
    .from("fi_cases")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (e5) throw new Error(e5.message);

  const { count: fi_cases_with_foundation_patient_id, error: e6 } = await supabase
    .from("fi_cases")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .not("foundation_patient_id", "is", null);
  if (e6) throw new Error(e6.message);

  const { count: fi_timeline_events, error: e7 } = await supabase
    .from("fi_timeline_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (e7) throw new Error(e7.message);

  const { count: fi_media_assets, error: e8 } = await supabase
    .from("fi_media_assets")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid);
  if (e8) throw new Error(e8.message);

  const tenantEventIds = await loadTenantEventIds(supabase, tid);
  if (tenantEventIds.length >= 200_000) {
    notes.push("Event id scan capped at 200k rows; coverage counts may under-count.");
  }
  const eventToCase = await buildEventToCaseMap(supabase, tenantEventIds);
  const coverage = await computeCoverageFromCaseMap(supabase, tid, tenantEventIds, eventToCase);

  const { count: unresolved_global_patients_count, error: u1 } = await supabase
    .from("v_fi_patient_resolution")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .not("global_patient_id", "is", null)
    .is("foundation_patient_id", null);
  if (u1) throw new Error(u1.message);

  const { count: unresolved_cases_no_foundation_patient_count, error: u2 } = await supabase
    .from("v_fi_case_foundation")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .is("foundation_patient_id", null);
  if (u2) throw new Error(u2.message);

  const { count: fi_media_assets_without_case_id_count, error: m1 } = await supabase
    .from("fi_media_assets")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .is("case_id", null);
  if (m1) throw new Error(m1.message);

  let unified_media_without_case_id = 0;
  const { count: um, error: umErr } = await supabase
    .from("v_fi_media_unified")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .is("case_id", null);
  if (umErr) {
    notes.push(`v_fi_media_unified count skipped: ${umErr.message}`);
  } else {
    unified_media_without_case_id = um ?? 0;
  }

  const { data: timelineRows, error: t1 } = await supabase
    .from("fi_timeline_events")
    .select("id, detail")
    .eq("tenant_id", tid)
    .limit(50_000);
  if (t1) throw new Error(t1.message);
  let fi_timeline_events_detail_empty_or_null = 0;
  for (const row of timelineRows ?? []) {
    if (isDetailEmpty((row as { detail: unknown }).detail)) fi_timeline_events_detail_empty_or_null += 1;
  }
  if ((timelineRows ?? []).length >= 50_000) {
    notes.push("Sparse timeline detail count sampled on first 50k timeline rows only.");
  }

  const emailMap = new Map<string, string[]>();
  let personPage = 0;
  const personPageSize = 1000;
  for (;;) {
    const { data: persons, error: pe } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .range(personPage * personPageSize, personPage * personPageSize + personPageSize - 1);
    if (pe) throw new Error(pe.message);
    const batch = persons ?? [];
    if (batch.length === 0) break;
    for (const row of batch) {
      const email = readEmailNormalized((row as { metadata: unknown }).metadata);
      if (!email) continue;
      const id = String((row as { id: string }).id);
      const arr = emailMap.get(email) ?? [];
      arr.push(id);
      emailMap.set(email, arr);
    }
    if (batch.length < personPageSize) break;
    personPage += 1;
    if (personPage > 500) {
      notes.push("Person duplicate scan stopped after 500k person rows.");
      break;
    }
  }

  let duplicate_person_email_normalized_groups = 0;
  const duplicate_person_emails: DuplicatePersonEmailPreview[] = [];
  for (const [email, ids] of Array.from(emailMap.entries())) {
    if (ids.length > 1) {
      duplicate_person_email_normalized_groups += 1;
      if (duplicate_person_emails.length < 20) {
        duplicate_person_emails.push({
          email_normalized: email,
          person_count: ids.length,
          person_ids: ids.slice(0, 12),
        });
      }
    }
  }

  const patientPersonCounts = new Map<string, number>();
  let patientPage = 0;
  for (;;) {
    const { data: pats, error: pae } = await supabase
      .from("fi_patients")
      .select("person_id")
      .eq("tenant_id", tid)
      .range(patientPage * personPageSize, patientPage * personPageSize + personPageSize - 1);
    if (pae) throw new Error(pae.message);
    const batch = pats ?? [];
    if (batch.length === 0) break;
    for (const row of batch) {
      const pid = String((row as { person_id: string }).person_id);
      patientPersonCounts.set(pid, (patientPersonCounts.get(pid) ?? 0) + 1);
    }
    if (batch.length < personPageSize) break;
    patientPage += 1;
    if (patientPage > 500) break;
  }
  let duplicate_patient_rows_same_person_id = 0;
  for (const c of Array.from(patientPersonCounts.values())) {
    if (c > 1) duplicate_patient_rows_same_person_id += 1;
  }

  const { data: upRows, error: up1 } = await supabase
    .from("v_fi_patient_resolution")
    .select("global_patient_id, source_system, source_patient_id")
    .eq("tenant_id", tid)
    .not("global_patient_id", "is", null)
    .is("foundation_patient_id", null)
    .limit(30);
  if (up1) throw new Error(up1.message);
  const unresolved_global_patients: UnresolvedGlobalPatientPreview[] = (upRows ?? []).map((r) => ({
    global_patient_id: String((r as { global_patient_id: string }).global_patient_id),
    source_system: String((r as { source_system: string }).source_system),
    source_patient_id: String((r as { source_patient_id: string }).source_patient_id),
  }));

  const { data: ucRows, error: uc1 } = await supabase
    .from("v_fi_case_foundation")
    .select("case_id, global_case_id, global_patient_id, status, source_system, source_case_id")
    .eq("tenant_id", tid)
    .is("foundation_patient_id", null)
    .limit(30);
  if (uc1) throw new Error(uc1.message);
  const unresolved_cases: UnresolvedCasePreview[] = (ucRows ?? []).map((r) => ({
    case_id: String((r as { case_id: string }).case_id),
    global_case_id: (r as { global_case_id: string | null }).global_case_id,
    global_patient_id: (r as { global_patient_id: string | null }).global_patient_id,
    status: String((r as { status: string }).status),
    source_system: (r as { source_system: string | null }).source_system,
    source_case_id: (r as { source_case_id: string | null }).source_case_id,
  }));

  return {
    tenant_id: tid,
    totals: {
      fi_events: fi_events ?? 0,
      fi_events_processed: fi_events_processed ?? 0,
      fi_persons: fi_persons ?? 0,
      fi_patients: fi_patients ?? 0,
      fi_cases: fi_cases ?? 0,
      fi_cases_with_foundation_patient_id: fi_cases_with_foundation_patient_id ?? 0,
      fi_timeline_events: fi_timeline_events ?? 0,
      fi_media_assets: fi_media_assets ?? 0,
    },
    coverage,
    risks: {
      unresolved_global_patients: unresolved_global_patients_count ?? 0,
      unresolved_cases_no_foundation_patient: unresolved_cases_no_foundation_patient_count ?? 0,
      duplicate_person_email_normalized_groups,
      duplicate_patient_rows_same_person_id,
      fi_media_assets_without_case_id: fi_media_assets_without_case_id_count ?? 0,
      fi_timeline_events_detail_empty_or_null,
    },
    previews: {
      unresolved_global_patients: unresolved_global_patients,
      unresolved_cases: unresolved_cases,
      duplicate_person_emails,
    },
    unified_media_without_case_id,
    notes,
  };
}
