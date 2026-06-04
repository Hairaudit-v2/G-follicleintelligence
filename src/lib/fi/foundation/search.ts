/**
 * Stage 1J — tenant-scoped read-only foundation search / directory.
 * Uses v_fi_patient_resolution, v_fi_case_foundation, v_fi_media_unified (optional future),
 * fi_persons, fi_patients, fi_cases, fi_organisations, fi_clinics via service-role access only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enrichCasesWithExternalAndNames } from "./patientRecord";
import type { FoundationSupabase } from "./types";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export type FoundationSearchFilter = "all" | "patients" | "cases" | "clinics" | "organisations";

export type FoundationSearchHit = {
  id: string;
  title: string;
  subtitle: string;
  type: "patient" | "case" | "clinic" | "organisation";
  href: string;
  source_system: string | null;
  warning: string | null;
};

export type SearchFoundationRecordsParams = {
  tenantId: string;
  query?: string | null;
  /** Filter which groups are populated; default `all`. */
  type?: FoundationSearchFilter | null;
  limit?: number | null;
};

export type FoundationSearchGroupedResult = {
  tenant_id: string;
  query: string | null;
  filter: FoundationSearchFilter;
  limit: number;
  patients: FoundationSearchHit[];
  cases: FoundationSearchHit[];
  clinics: FoundationSearchHit[];
  organisations: FoundationSearchHit[];
};

function normalizeFilter(t: string | null | undefined): FoundationSearchFilter {
  const v = (t ?? "all").toLowerCase().trim();
  if (v === "patients" || v === "cases" || v === "clinics" || v === "organisations") return v;
  return "all";
}

function capLimit(n: number | null | undefined): number {
  const x = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : DEFAULT_LIMIT;
  return Math.min(Math.max(1, x), MAX_LIMIT);
}

/** Escape `%`, `_`, `\` for PostgREST `ilike` patterns. */
export function escapeIlikePattern(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function uuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

function adminBase(tenantId: string): string {
  return `/fi-admin/${tenantId}`;
}

function patientHref(tenantId: string, foundationPatientId: string | null, globalPatientId: string | null): string {
  const slug = foundationPatientId ?? globalPatientId;
  return `${adminBase(tenantId)}/patients/${slug ?? ""}`;
}

export async function searchFoundationRecords(
  params: SearchFoundationRecordsParams,
  client?: FoundationSupabase
): Promise<FoundationSearchGroupedResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const filter = normalizeFilter(params.type ?? undefined);
  const limit = capLimit(params.limit ?? undefined);
  const rawQ = params.query?.trim() ?? "";
  const query = rawQ.length > 0 ? rawQ.slice(0, 120) : null;

  const want = (g: FoundationSearchFilter) => filter === "all" || filter === g;

  const patients: FoundationSearchHit[] = [];
  const cases: FoundationSearchHit[] = [];
  const clinics: FoundationSearchHit[] = [];
  const organisations: FoundationSearchHit[] = [];

  const seenPatient = new Set<string>();
  const seenCase = new Set<string>();
  const seenClinic = new Set<string>();
  const seenOrg = new Set<string>();

  const pushPatient = (h: FoundationSearchHit, dedupeKey: string) => {
    if (seenPatient.has(dedupeKey)) return;
    seenPatient.add(dedupeKey);
    patients.push(h);
  };

  if (want("patients")) {
    let q = supabase.from("v_fi_patient_resolution").select("*").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(limit);

    if (query) {
      const p = `%${escapeIlikePattern(query)}%`;
      const parts = [
        `display_name.ilike.${p}`,
        `email.ilike.${p}`,
        `phone.ilike.${p}`,
        `source_system.ilike.${p}`,
        `source_patient_id.ilike.${p}`,
      ];
      if (uuidLike(query)) {
        const id = query.trim();
        parts.push(`global_patient_id.eq.${id}`);
        parts.push(`foundation_patient_id.eq.${id}`);
        parts.push(`person_id.eq.${id}`);
      }
      q = q.or(parts.join(","));
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        global_patient_id: string | null;
        foundation_patient_id: string | null;
        person_id: string | null;
        source_system: string;
        source_patient_id: string;
        display_name: string | null;
        email: string | null;
        phone: string | null;
      };
      const slug = r.foundation_patient_id ?? r.global_patient_id;
      if (!slug) continue;
      const title = r.display_name?.trim() || "Patient (unnamed)";
      const subtitle = [r.email, r.phone].filter(Boolean).join(" · ") || `${r.source_system}:${r.source_patient_id}`;
      let warning: string | null = null;
      if (r.global_patient_id && !r.foundation_patient_id) {
        warning = "No foundation patient linked for this global stub.";
      }
      if (!r.person_id && r.foundation_patient_id) {
        warning = warning ? `${warning} No person_id on record.` : "No person_id resolved.";
      }
      const dedupeKey = r.foundation_patient_id ? `fp:${r.foundation_patient_id}` : `gp:${r.global_patient_id}`;
      pushPatient(
        {
          id: slug,
          title,
          subtitle,
          type: "patient",
          href: patientHref(tid, r.foundation_patient_id, r.global_patient_id),
          source_system: r.source_system ?? null,
          warning,
        },
        dedupeKey
      );
      if (patients.length >= limit) break;
    }
  }

  if (want("cases")) {
    const orgIdsForCaseBoost = new Set<string>();
    const clinicIdsForCaseBoost = new Set<string>();
    if (query) {
      const p = `%${escapeIlikePattern(query)}%`;
      const { data: orgMatch } = await supabase
        .from("fi_organisations")
        .select("id")
        .eq("tenant_id", tid)
        .ilike("name", p)
        .limit(limit);
      for (const o of orgMatch ?? []) orgIdsForCaseBoost.add(String((o as { id: string }).id));
      const { data: clMatch } = await supabase
        .from("fi_clinics")
        .select("id")
        .eq("tenant_id", tid)
        .ilike("display_name", p)
        .limit(limit);
      for (const c of clMatch ?? []) clinicIdsForCaseBoost.add(String((c as { id: string }).id));
    }

    let q = supabase.from("v_fi_case_foundation").select("*").eq("tenant_id", tid).order("updated_at", { ascending: false }).limit(limit);

    if (query) {
      const p = `%${escapeIlikePattern(query)}%`;
      const parts = [
        `case_type.ilike.${p}`,
        `status.ilike.${p}`,
        `source_system.ilike.${p}`,
        `source_case_id.ilike.${p}`,
      ];
      if (uuidLike(query)) {
        const id = query.trim();
        parts.push(`case_id.eq.${id}`);
        parts.push(`global_case_id.eq.${id}`);
        parts.push(`foundation_patient_id.eq.${id}`);
        parts.push(`global_patient_id.eq.${id}`);
        parts.push(`person_id.eq.${id}`);
        parts.push(`clinic_id.eq.${id}`);
        parts.push(`organisation_id.eq.${id}`);
      }
      let orExpr = parts.join(",");
      if (orgIdsForCaseBoost.size > 0) {
        orExpr += `,organisation_id.in.(${Array.from(orgIdsForCaseBoost).join(",")})`;
      }
      if (clinicIdsForCaseBoost.size > 0) {
        orExpr += `,clinic_id.in.(${Array.from(clinicIdsForCaseBoost).join(",")})`;
      }
      q = q.or(orExpr);
    }

    const { data: rawCases, error: cErr } = await q;
    if (cErr) throw new Error(cErr.message);
    const enriched = await enrichCasesWithExternalAndNames(supabase, tid, (rawCases ?? []) as Record<string, unknown>[]);

    for (const c of enriched) {
      if (seenCase.has(c.case_id)) continue;
      seenCase.add(c.case_id);
      const title = c.case_type?.trim() || `Case ${c.case_id.slice(0, 8)}…`;
      const subtitle = [c.status, c.source_system, c.source_case_id, c.external_id].filter(Boolean).join(" · ");
      let warning: string | null = null;
      if (!c.foundation_patient_id) warning = "No foundation_patient_id on case.";
      cases.push({
        id: c.case_id,
        title,
        subtitle: subtitle || c.case_id,
        type: "case",
        href: `${adminBase(tid)}/cases/${c.case_id}`,
        source_system: c.source_system ?? null,
        warning,
      });
      if (cases.length >= limit) break;
    }
  }

  if (want("clinics")) {
    let q = supabase
      .from("fi_clinics")
      .select("id, display_name, metadata, created_at")
      .eq("tenant_id", tid)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (query) {
      const p = `%${escapeIlikePattern(query)}%`;
      const parts = [`display_name.ilike.${p}`];
      if (uuidLike(query)) parts.push(`id.eq.${query.trim()}`);
      q = q.or(parts.join(","));
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = String((row as { id: string }).id);
      if (seenClinic.has(id)) continue;
      seenClinic.add(id);
      const meta = ((row as { metadata: unknown }).metadata as Record<string, unknown>) ?? {};
      const city = typeof meta.city === "string" ? meta.city : typeof meta.locality === "string" ? meta.locality : null;
      const country =
        typeof meta.country === "string" ? meta.country : typeof meta.country_code === "string" ? meta.country_code : null;
      const loc = [city, country].filter(Boolean).join(", ");
      clinics.push({
        id,
        title: String((row as { display_name: string }).display_name),
        subtitle: loc || id.slice(0, 8) + "…",
        type: "clinic",
        href: `${adminBase(tid)}/directory#clinic-${id}`,
        source_system: null,
        warning: null,
      });
      if (clinics.length >= limit) break;
    }
  }

  if (want("organisations")) {
    let q = supabase
      .from("fi_organisations")
      .select("id, name, organisation_type, created_at")
      .eq("tenant_id", tid)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (query) {
      const p = `%${escapeIlikePattern(query)}%`;
      const parts = [`name.ilike.${p}`, `organisation_type.ilike.${p}`];
      if (uuidLike(query)) parts.push(`id.eq.${query.trim()}`);
      q = q.or(parts.join(","));
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const id = String((row as { id: string }).id);
      if (seenOrg.has(id)) continue;
      seenOrg.add(id);
      const orgType = String((row as { organisation_type: string }).organisation_type);
      organisations.push({
        id,
        title: String((row as { name: string }).name),
        subtitle: orgType,
        type: "organisation",
        href: `${adminBase(tid)}/directory#organisation-${id}`,
        source_system: null,
        warning: null,
      });
      if (organisations.length >= limit) break;
    }
  }

  return {
    tenant_id: tid,
    query,
    filter,
    limit,
    patients,
    cases,
    clinics,
    organisations,
  };
}
