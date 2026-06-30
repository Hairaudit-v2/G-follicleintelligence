/**
 * FoundationOS dashboard — composes `loadFoundationIntegrityMetrics` with supplemental read-only counts.
 * All queries are tenant-scoped; uses service-role client (same as integrity API / admin loaders).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { FoundationOsDashboardPayload } from "./foundationOsDashboardTypes";
import { loadFoundationIntegrityMetrics } from "./integrity";

const SCAN_CAP = 100_000;
const PAGE = 1000;

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((100 * num) / den);
}

/** Mean of defined percentages only — skipped/failed signals stay out of the average. */
function meanCoverageHint(parts: (number | null)[]): number {
  const xs = parts.filter((v): v is number => v !== null && Number.isFinite(v));
  if (xs.length === 0) return 0;
  return Math.min(100, Math.round(xs.reduce((a, b) => a + b, 0) / xs.length));
}

async function distinctPatientIdsFromTimeline(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ size: number; capped: boolean }> {
  const set = new Set<string>();
  let from = 0;
  let capped = false;
  for (;;) {
    const { data, error } = await supabase
      .from("fi_timeline_events")
      .select("patient_id")
      .eq("tenant_id", tenantId)
      .not("patient_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { patient_id: string | null }[];
    for (const r of rows) {
      if (r.patient_id) set.add(String(r.patient_id));
      if (set.size >= SCAN_CAP) {
        capped = true;
        return { size: set.size, capped };
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
    if (from >= SCAN_CAP) {
      capped = true;
      break;
    }
  }
  return { size: set.size, capped };
}

async function distinctPatientIdsFromCrmLeads(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ size: number; capped: boolean }> {
  const set = new Set<string>();
  let from = 0;
  let capped = false;
  for (;;) {
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select("patient_id")
      .eq("tenant_id", tenantId)
      .not("patient_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { patient_id: string | null }[];
    for (const r of rows) {
      if (r.patient_id) set.add(String(r.patient_id));
      if (set.size >= SCAN_CAP) {
        capped = true;
        return { size: set.size, capped };
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
    if (from >= SCAN_CAP) {
      capped = true;
      break;
    }
  }
  return { size: set.size, capped };
}

async function paginatedDistinctUnifiedPatients(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ size: number; capped: boolean; skipped: boolean }> {
  const set = new Set<string>();
  let from = 0;
  let capped = false;
  for (;;) {
    const { data, error } = await supabase
      .from("v_fi_media_unified")
      .select("foundation_patient_id")
      .eq("tenant_id", tenantId)
      .not("foundation_patient_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      return { size: 0, capped: false, skipped: true };
    }
    const rows = (data ?? []) as { foundation_patient_id: string }[];
    for (const r of rows) {
      if (r.foundation_patient_id) set.add(String(r.foundation_patient_id));
      if (set.size >= SCAN_CAP) {
        capped = true;
        return { size: set.size, capped, skipped: false };
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
    if (from >= SCAN_CAP) {
      capped = true;
      break;
    }
  }
  return { size: set.size, capped, skipped: false };
}

export async function loadFoundationOsDashboard(
  tenantId: string
): Promise<FoundationOsDashboardPayload> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const integrity = await loadFoundationIntegrityMetrics(tid, supabase);
  const scan_notes = [...integrity.notes];

  const [
    { count: fi_uploads, error: upErr },
    { count: unified_total, error: uniErr },
    { count: unified_without_patient, error: uwpErr },
    { count: resolution_with_foundation, error: rwfErr },
    { count: resolution_foundation_only, error: rfoErr },
    { count: resolution_rows_global, error: rrgErr },
    { count: resolution_rows_global_linked, error: rglErr },
    { count: reports_total, error: repErr },
  ] = await Promise.all([
    supabase.from("fi_uploads").select("*", { count: "exact", head: true }).eq("tenant_id", tid),
    supabase
      .from("v_fi_media_unified")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid),
    supabase
      .from("v_fi_media_unified")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .is("foundation_patient_id", null),
    supabase
      .from("v_fi_patient_resolution")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .not("foundation_patient_id", "is", null),
    supabase
      .from("v_fi_patient_resolution")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .is("global_patient_id", null)
      .not("foundation_patient_id", "is", null),
    supabase
      .from("v_fi_patient_resolution")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .not("global_patient_id", "is", null),
    supabase
      .from("v_fi_patient_resolution")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .not("global_patient_id", "is", null)
      .not("foundation_patient_id", "is", null),
    supabase.from("fi_reports").select("*", { count: "exact", head: true }).eq("tenant_id", tid),
  ]);

  if (upErr) throw new Error(upErr.message);
  if (rwfErr) throw new Error(rwfErr.message);
  if (rfoErr) throw new Error(rfoErr.message);
  if (rrgErr) throw new Error(rrgErr.message);
  if (rglErr) throw new Error(rglErr.message);

  let unified_media_rows: number | null = unified_total ?? 0;
  if (uniErr) {
    unified_media_rows = null;
    scan_notes.push(`v_fi_media_unified total count skipped: ${uniErr.message}`);
  }
  if (uwpErr) {
    scan_notes.push(`v_fi_media_unified without patient count skipped: ${uwpErr.message}`);
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: fi_events_last_7_days, error: e7 } = await supabase
    .from("fi_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .gte("created_at", weekAgo);
  if (e7) throw new Error(e7.message);

  const { count: timeline_with_patient, error: twpErr } = await supabase
    .from("fi_timeline_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .not("patient_id", "is", null);
  if (twpErr) throw new Error(twpErr.message);

  const [distinctTimeline, distinctUnified, distinctCrm] = await Promise.all([
    distinctPatientIdsFromTimeline(supabase, tid),
    paginatedDistinctUnifiedPatients(supabase, tid),
    distinctPatientIdsFromCrmLeads(supabase, tid),
  ]);

  if (distinctTimeline.capped)
    scan_notes.push(`Distinct patients with timeline rows capped at ${SCAN_CAP} scanned rows.`);
  if (distinctUnified.capped)
    scan_notes.push(`Distinct patients with unified media capped at ${SCAN_CAP} view rows.`);
  if (distinctUnified.skipped)
    scan_notes.push("Unified media patient distinct scan skipped (view error).");
  if (distinctCrm.capped)
    scan_notes.push(`Distinct CRM-linked patients capped at ${SCAN_CAP} lead rows.`);

  /** Distinct foundation patients reachable via a case that has any fi_reports row. */
  let auditPatients = 0;
  let audit_scan_ok = true;
  if (!repErr && (reports_total ?? 0) > 0) {
    const caseSet = new Set<string>();
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("fi_reports")
        .select("case_id")
        .eq("tenant_id", tid)
        .range(from, from + PAGE - 1);
      if (error) {
        audit_scan_ok = false;
        scan_notes.push(`Audit linkage scan skipped: ${error.message}`);
        break;
      }
      const rows = (data ?? []) as { case_id: string }[];
      for (const r of rows) caseSet.add(String(r.case_id));
      if (caseSet.size >= SCAN_CAP) {
        scan_notes.push(`Audit case id scan capped at ${SCAN_CAP} distinct case ids.`);
        break;
      }
      if (rows.length < PAGE) break;
      from += PAGE;
      if (from >= SCAN_CAP) break;
    }
    const caseIds = Array.from(caseSet);
    const patientSet = new Set<string>();
    for (let i = 0; i < caseIds.length; i += PAGE) {
      const slice = caseIds.slice(i, i + PAGE);
      const { data, error } = await supabase
        .from("fi_cases")
        .select("foundation_patient_id")
        .eq("tenant_id", tid)
        .is("deleted_at", null)
        .in("id", slice);
      if (error) {
        audit_scan_ok = false;
        scan_notes.push(`Audit patient linkage skipped: ${error.message}`);
        break;
      }
      for (const row of data ?? []) {
        const fp = (row as { foundation_patient_id: string | null }).foundation_patient_id;
        if (fp) patientSet.add(String(fp));
      }
    }
    auditPatients = patientSet.size;
  } else if (repErr) {
    audit_scan_ok = false;
    scan_notes.push(`fi_reports count skipped: ${repErr.message}`);
  }

  const fp = integrity.totals.fi_patients;
  const casesTot = integrity.totals.fi_cases;
  const casesWithFp = integrity.totals.fi_cases_with_foundation_patient_id;
  const missingFp = Math.max(0, casesTot - casesWithFp);

  const twin_health = {
    foundation_patients: fp,
    persons: integrity.totals.fi_persons,
    cases_total: casesTot,
    cases_with_foundation_patient: casesWithFp,
    cases_missing_foundation_patient: missingFp,
    patients_with_timeline_events_distinct: distinctTimeline.size,
    patients_with_unified_media_distinct: distinctUnified.size,
    patients_with_crm_lead_distinct: distinctCrm.size,
    patients_with_audit_case_distinct: auditPatients,
    reports_total: reports_total ?? 0,
  };

  const identity = {
    resolution_rows_with_foundation: resolution_with_foundation ?? 0,
    resolution_rows_global_only: integrity.risks.unresolved_global_patients,
    resolution_rows_foundation_only_no_global: resolution_foundation_only ?? 0,
    duplicate_person_email_groups: integrity.risks.duplicate_person_email_normalized_groups,
    duplicate_patient_rows_same_person_id: integrity.risks.duplicate_patient_rows_same_person_id,
  };

  const media = {
    fi_uploads: fi_uploads ?? 0,
    fi_media_assets: integrity.totals.fi_media_assets,
    unified_media_rows: unified_media_rows,
    unified_media_without_case: integrity.unified_media_without_case_id,
    fi_media_assets_without_case_id: integrity.risks.fi_media_assets_without_case_id,
    unified_rows_without_patient: uwpErr ? null : (unified_without_patient ?? 0),
  };

  const timeline_events = {
    fi_events: integrity.totals.fi_events,
    fi_events_processed: integrity.totals.fi_events_processed,
    fi_events_last_7_days: fi_events_last_7_days ?? 0,
    fi_timeline_events: integrity.totals.fi_timeline_events,
    timeline_events_with_patient_id: timeline_with_patient ?? 0,
    timeline_events_with_empty_detail_sample:
      integrity.risks.fi_timeline_events_detail_empty_or_null,
    events_with_fi_case_link: integrity.coverage.events_with_fi_case_link,
    events_with_foundation_patient_on_linked_case:
      integrity.coverage.events_with_foundation_patient_on_linked_case,
    events_with_person_on_linked_foundation_patient:
      integrity.coverage.events_with_person_on_linked_foundation_patient,
  };

  const globalRows = resolution_rows_global ?? 0;
  /** No global stubs in the resolution view — percentage would read as misleading. */
  const identity_global_resolution_pct =
    globalRows > 0 ? pct(resolution_rows_global_linked ?? 0, globalRows) : null;

  const surgeryos_linkage_pct = pct(casesWithFp, Math.max(casesTot, 1));
  const timeline_coverage_pct = pct(distinctTimeline.size, Math.max(fp, 1));
  const media_coverage_pct = distinctUnified.skipped
    ? null
    : pct(distinctUnified.size, Math.max(fp, 1));
  const crm_coverage_pct = pct(distinctCrm.size, Math.max(fp, 1));
  const audit_case_coverage_pct = audit_scan_ok
    ? fp > 0
      ? pct(auditPatients, Math.max(fp, 1))
      : 0
    : null;

  const twin_readiness_score_hint = meanCoverageHint([
    timeline_coverage_pct,
    media_coverage_pct,
    crm_coverage_pct,
    audit_case_coverage_pct,
    surgeryos_linkage_pct,
    identity_global_resolution_pct,
  ]);

  const twin_coverage = {
    timeline_coverage_pct,
    media_coverage_pct,
    crm_coverage_pct,
    audit_case_coverage_pct,
    surgeryos_linkage_pct,
    identity_global_resolution_pct,
    twin_readiness_score_hint,
  };

  if (media.fi_uploads > 0 && media.fi_media_assets === 0) {
    scan_notes.push(
      "fi_uploads has rows but fi_media_assets is empty — often indicates foundation media dual-write is not yet writing assets for this tenant (confirm pipeline; uploads may still exist only in legacy tables)."
    );
  }

  return {
    tenant_id: tid,
    integrity,
    twin_health,
    identity,
    media,
    timeline_events,
    twin_coverage,
    scan_notes,
  };
}
