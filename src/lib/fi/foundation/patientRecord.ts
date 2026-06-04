/**
 * Stage 1H — Universal Patient Record (read-only aggregate loader).
 * Uses v_fi_patient_resolution, v_fi_case_foundation, v_fi_media_unified, fi_timeline_events, fi_media_assets.
 * Service-role / server-only; does not modify ingest or dual-write paths.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FoundationSupabase } from "./types";

const CHUNK = 400;

export type PatientResolutionRow = {
  tenant_id: string;
  global_patient_id: string | null;
  foundation_patient_id: string | null;
  person_id: string | null;
  source_system: string;
  source_patient_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type PatientSummary = {
  foundation_patient_id: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  primary_clinic_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
} | null;

export type PersonSummary = {
  person_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
} | null;

export type SourceIdentifierRow = {
  source_system: string;
  source_patient_id: string;
  created_at: string;
};

export type CaseFoundationRow = {
  case_id: string;
  global_case_id: string | null;
  foundation_patient_id: string | null;
  global_patient_id: string | null;
  person_id: string | null;
  clinic_id: string | null;
  organisation_id: string | null;
  case_type: string | null;
  status: string;
  source_system: string | null;
  source_case_id: string | null;
  external_id: string | null;
  clinic_display_name: string | null;
  organisation_name: string | null;
  created_at: string;
  updated_at: string;
};

export type TimelineEventRow = {
  id: string;
  case_id: string;
  patient_id: string | null;
  event_kind: string;
  title: string | null;
  occurred_at: string;
  fi_event_id: string | null;
  source_system: string | null;
};

export type UnifiedMediaRow = {
  media_asset_id: string | null;
  legacy_upload_id: string | null;
  foundation_patient_id: string | null;
  case_id: string | null;
  source_system: string | null;
  asset_type: string | null;
  storage_path: string | null;
  file_name: string | null;
  created_at: string | null;
};

export type LoadUniversalPatientRecordParams = {
  tenantId: string;
  /**
   * Ambiguous id from URL: try fi_patients first, then fi_global_patients.
   * Ignored if foundationPatientId / globalPatientId / personId is set explicitly.
   */
  patientId?: string | null;
  foundationPatientId?: string | null;
  globalPatientId?: string | null;
  personId?: string | null;
};

export type UniversalPatientRecordResult = {
  ok: true;
  tenant_id: string;
  /** How the record was anchored for loading. */
  anchor: {
    mode: "foundation" | "global_stub" | "person";
    primary_foundation_patient_id: string | null;
    all_foundation_patient_ids: string[];
    primary_global_patient_id: string | null;
    person_id: string | null;
  };
  patient: PatientSummary;
  person: PersonSummary;
  resolution_rows: PatientResolutionRow[];
  source_identifiers: SourceIdentifierRow[];
  linked_global_patient_ids: string[];
  cases: CaseFoundationRow[];
  timeline_events: TimelineEventRow[];
  media_unified: UnifiedMediaRow[];
  /** Direct fi_media_assets rows for this tenant scoped to resolved patients + case list (subset for operator visibility). */
  media_assets_direct: Array<{
    id: string;
    case_id: string | null;
    patient_id: string | null;
    asset_type: string;
    filename: string;
    storage_path: string;
    source_system: string | null;
    created_at: string;
  }>;
  warnings: string[];
};

export type UniversalPatientRecordNotFound = {
  ok: false;
  error: "not_found" | "bad_request";
  message: string;
};

function timelineSourceFromDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const d = detail as Record<string, unknown>;
  const direct = d.source_system;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const meta = d.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const m = (meta as Record<string, unknown>).source_system;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return null;
}

function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id && typeof id === "string") s.add(id.trim());
  }
  return Array.from(s);
}

async function fetchCasesForGlobalPatient(
  supabase: SupabaseClient,
  tenantId: string,
  globalPatientId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("fi_global_cases")
    .select("fi_case_id")
    .eq("tenant_id", tenantId)
    .eq("global_patient_id", globalPatientId)
    .not("fi_case_id", "is", null);
  if (error) throw new Error(error.message);
  const out: string[] = [];
  for (const row of data ?? []) {
    const id = (row as { fi_case_id: string | null }).fi_case_id;
    if (id) out.push(String(id));
  }
  return uniqueStrings(out);
}

/** Shared by universal patient (1H) and universal case (1I) loaders. */
export async function enrichCasesWithExternalAndNames(
  supabase: SupabaseClient,
  tenantId: string,
  viewRows: Record<string, unknown>[]
): Promise<CaseFoundationRow[]> {
  const caseIds = uniqueStrings(viewRows.map((r) => String((r as { case_id: string }).case_id)));
  const extByCase = new Map<string, string | null>();
  for (let i = 0; i < caseIds.length; i += CHUNK) {
    const slice = caseIds.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("fi_cases")
      .select("id, external_id")
      .eq("tenant_id", tenantId)
      .in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      extByCase.set(String((row as { id: string }).id), (row as { external_id: string | null }).external_id);
    }
  }

  const clinicIds = uniqueStrings(viewRows.map((r) => (r as { clinic_id: string | null }).clinic_id));
  const orgIds = uniqueStrings(viewRows.map((r) => (r as { organisation_id: string | null }).organisation_id));
  const clinicName = new Map<string, string>();
  for (let i = 0; i < clinicIds.length; i += CHUNK) {
    const slice = clinicIds.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("fi_clinics")
      .select("id, display_name")
      .eq("tenant_id", tenantId)
      .in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      clinicName.set(String((row as { id: string }).id), String((row as { display_name: string }).display_name));
    }
  }
  const orgName = new Map<string, string>();
  for (let i = 0; i < orgIds.length; i += CHUNK) {
    const slice = orgIds.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("fi_organisations")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      orgName.set(String((row as { id: string }).id), String((row as { name: string }).name));
    }
  }

  return viewRows.map((r) => {
    const caseId = String((r as { case_id: string }).case_id);
    const clinicId = (r as { clinic_id: string | null }).clinic_id;
    const orgId = (r as { organisation_id: string | null }).organisation_id;
    return {
      case_id: caseId,
      global_case_id: (r as { global_case_id: string | null }).global_case_id,
      foundation_patient_id: (r as { foundation_patient_id: string | null }).foundation_patient_id,
      global_patient_id: (r as { global_patient_id: string | null }).global_patient_id,
      person_id: (r as { person_id: string | null }).person_id,
      clinic_id: clinicId,
      organisation_id: orgId,
      case_type: (r as { case_type: string | null }).case_type,
      status: String((r as { status: string }).status),
      source_system: (r as { source_system: string | null }).source_system,
      source_case_id: (r as { source_case_id: string | null }).source_case_id,
      external_id: extByCase.get(caseId) ?? null,
      clinic_display_name: clinicId ? clinicName.get(clinicId) ?? null : null,
      organisation_name: orgId ? orgName.get(orgId) ?? null : null,
      created_at: String((r as { created_at: string }).created_at),
      updated_at: String((r as { updated_at: string }).updated_at),
    };
  });
}

/**
 * Load a read-only universal patient record for FI Admin.
 * Resolves `patientId` as foundation fi_patients.id first, then fi_global_patients.id.
 */
export async function loadUniversalPatientRecord(
  params: LoadUniversalPatientRecordParams,
  client?: FoundationSupabase
): Promise<UniversalPatientRecordResult | UniversalPatientRecordNotFound> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  if (!tid) {
    return { ok: false, error: "bad_request", message: "Missing tenantId." };
  }

  let foundationIds: string[] = [];
  let primaryGlobalId: string | null = null;
  let anchorMode: "foundation" | "global_stub" | "person" = "foundation";
  let explicitPerson: string | null = null;

  const gp = params.globalPatientId?.trim();
  const pe = params.personId?.trim();
  const slug = params.patientId?.trim();

  if (pe) {
    explicitPerson = pe;
    anchorMode = "person";
    const { data: pats, error: peErr } = await supabase
      .from("fi_patients")
      .select("id")
      .eq("tenant_id", tid)
      .eq("person_id", pe);
    if (peErr) throw new Error(peErr.message);
    foundationIds = uniqueStrings((pats ?? []).map((r) => String((r as { id: string }).id)));
    if (foundationIds.length === 0) {
      return { ok: false, error: "not_found", message: "No fi_patients rows for this person_id in tenant." };
    }
  } else if (params.foundationPatientId?.trim()) {
    const id = params.foundationPatientId.trim();
    const { data: row, error } = await supabase
      .from("fi_patients")
      .select("id")
      .eq("tenant_id", tid)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false, error: "not_found", message: "Foundation patient not found." };
    foundationIds = [id];
  } else if (gp) {
    primaryGlobalId = gp;
    const { data: gRow, error: gErr } = await supabase
      .from("fi_global_patients")
      .select("id")
      .eq("tenant_id", tid)
      .eq("id", gp)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!gRow) return { ok: false, error: "not_found", message: "Global patient not found." };
    const { data: resRows, error: rErr } = await supabase
      .from("v_fi_patient_resolution")
      .select("*")
      .eq("tenant_id", tid)
      .eq("global_patient_id", gp);
    if (rErr) throw new Error(rErr.message);
    const fids = uniqueStrings(
      (resRows ?? []).map((r) => (r as { foundation_patient_id: string | null }).foundation_patient_id)
    );
    if (fids.length > 0) {
      foundationIds = fids;
      anchorMode = "foundation";
    } else {
      anchorMode = "global_stub";
      foundationIds = [];
    }
  } else if (slug) {
    const { data: asPatient, error: pErr } = await supabase
      .from("fi_patients")
      .select("id")
      .eq("tenant_id", tid)
      .eq("id", slug)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (asPatient) {
      foundationIds = [slug];
      anchorMode = "foundation";
    } else {
      const { data: asGlobal, error: gErr } = await supabase
        .from("fi_global_patients")
        .select("id")
        .eq("tenant_id", tid)
        .eq("id", slug)
        .maybeSingle();
      if (gErr) throw new Error(gErr.message);
      if (!asGlobal) {
        return { ok: false, error: "not_found", message: "patientId is not a foundation or global patient in this tenant." };
      }
      primaryGlobalId = slug;
      const { data: resRows, error: rErr } = await supabase
        .from("v_fi_patient_resolution")
        .select("*")
        .eq("tenant_id", tid)
        .eq("global_patient_id", slug);
      if (rErr) throw new Error(rErr.message);
      const fids = uniqueStrings(
        (resRows ?? []).map((r) => (r as { foundation_patient_id: string | null }).foundation_patient_id)
      );
      if (fids.length > 0) {
        foundationIds = fids;
        anchorMode = "foundation";
      } else {
        anchorMode = "global_stub";
        foundationIds = [];
      }
    }
  } else {
    return { ok: false, error: "bad_request", message: "Provide patientId, foundationPatientId, globalPatientId, or personId." };
  }

  const warnings: string[] = [];
  const primaryFoundationId = foundationIds[0] ?? null;

  if (anchorMode === "person" && foundationIds.length > 1) {
    warnings.push("Multiple fi_patients rows share this person_id; cases, media, and timeline are merged across all of them.");
  }

  let resolutionQuery = supabase.from("v_fi_patient_resolution").select("*").eq("tenant_id", tid);
  if (foundationIds.length > 0) {
    resolutionQuery = resolutionQuery.in("foundation_patient_id", foundationIds);
  } else if (primaryGlobalId) {
    resolutionQuery = resolutionQuery.eq("global_patient_id", primaryGlobalId);
  } else {
    resolutionQuery = resolutionQuery.limit(0);
  }
  const { data: resolutionData, error: resErr } = await resolutionQuery;
  if (resErr) throw new Error(resErr.message);
  const resolution_rows = (resolutionData ?? []) as unknown as PatientResolutionRow[];

  const linked_global_patient_ids = uniqueStrings(
    resolution_rows.map((r) => r.global_patient_id).filter(Boolean) as string[]
  );
  if (primaryGlobalId && !linked_global_patient_ids.includes(primaryGlobalId)) {
    linked_global_patient_ids.unshift(primaryGlobalId);
  }

  for (const r of resolution_rows) {
    if (r.global_patient_id && !r.foundation_patient_id) {
      warnings.push(
        `Global patient ${r.global_patient_id} (${r.source_system}:${r.source_patient_id}) has no foundation_patient_id in v_fi_patient_resolution.`
      );
    }
  }

  const globalCountByKey = new Map<string, number>();
  for (const r of resolution_rows) {
    if (!r.global_patient_id) continue;
    const k = `${r.source_system}:${r.source_patient_id}`;
    globalCountByKey.set(k, (globalCountByKey.get(k) ?? 0) + 1);
  }
  for (const [k, c] of Array.from(globalCountByKey.entries())) {
    if (c > 1) warnings.push(`Multiple resolution rows for source mapping ${k} (${c}); review fi_global_patients / fi_patient_source_ids.`);
  }

  let patient: PatientSummary = null;
  let person: PersonSummary = null;
  const source_identifiers: SourceIdentifierRow[] = [];

  if (primaryFoundationId) {
    const { data: pat, error: patErr } = await supabase
      .from("fi_patients")
      .select("id, tenant_id, person_id, primary_clinic_id, metadata, created_at, updated_at")
      .eq("tenant_id", tid)
      .eq("id", primaryFoundationId)
      .maybeSingle();
    if (patErr) throw new Error(patErr.message);
    if (pat) {
      const p = pat as {
        id: string;
        person_id: string;
        primary_clinic_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      };
      patient = {
        foundation_patient_id: p.id,
        display_name:
          (typeof p.metadata?.display_name === "string" && p.metadata.display_name) ||
          (typeof p.metadata?.patient_name === "string" && p.metadata.patient_name) ||
          null,
        email: typeof p.metadata?.email === "string" ? p.metadata.email : null,
        phone: typeof p.metadata?.phone === "string" ? p.metadata.phone : null,
        primary_clinic_id: p.primary_clinic_id,
        metadata: p.metadata ?? {},
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
      const { data: per, error: perErr } = await supabase
        .from("fi_persons")
        .select("id, tenant_id, metadata, created_at, updated_at")
        .eq("tenant_id", tid)
        .eq("id", p.person_id)
        .maybeSingle();
      if (perErr) throw new Error(perErr.message);
      if (per) {
        person = {
          person_id: String((per as { id: string }).id),
          metadata: ((per as { metadata: unknown }).metadata as Record<string, unknown>) ?? {},
          created_at: String((per as { created_at: string }).created_at),
          updated_at: String((per as { updated_at: string }).updated_at),
        };
      } else {
        warnings.push("fi_patients.person_id does not resolve to an fi_persons row.");
      }
    }

    for (let i = 0; i < foundationIds.length; i += CHUNK) {
      const slice = foundationIds.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      const { data: src, error: srcErr } = await supabase
        .from("fi_patient_source_ids")
        .select("source_system, source_patient_id, created_at")
        .eq("tenant_id", tid)
        .in("patient_id", slice);
      if (srcErr) throw new Error(srcErr.message);
      for (const row of src ?? []) {
        source_identifiers.push({
          source_system: String((row as { source_system: string }).source_system),
          source_patient_id: String((row as { source_patient_id: string }).source_patient_id),
          created_at: String((row as { created_at: string }).created_at),
        });
      }
    }
  } else if (primaryGlobalId && anchorMode === "global_stub") {
    const { data: g, error: gErr2 } = await supabase
      .from("fi_global_patients")
      .select("id, source_system, source_patient_id, metadata_json, created_at")
      .eq("tenant_id", tid)
      .eq("id", primaryGlobalId)
      .maybeSingle();
    if (gErr2) throw new Error(gErr2.message);
    if (g) {
      const meta = (g as { metadata_json: Record<string, unknown> }).metadata_json ?? {};
      patient = {
        foundation_patient_id: null,
        display_name:
          (typeof meta.patient_name === "string" && meta.patient_name) ||
          (typeof meta.display_name === "string" && meta.display_name) ||
          (typeof meta.full_name === "string" && meta.full_name) ||
          null,
        email: typeof meta.email === "string" ? meta.email : null,
        phone: typeof meta.phone === "string" ? meta.phone : null,
        primary_clinic_id: null,
        metadata: meta,
        created_at: String((g as { created_at: string }).created_at),
        updated_at: String((g as { created_at: string }).created_at),
      };
    }
    warnings.push("No foundation patient linked; showing global stub and any cases reachable via fi_global_cases only.");
  }

  if (!person?.person_id && patient?.foundation_patient_id) {
    warnings.push("No person_id resolved for this foundation patient (check fi_patients.person_id).");
  }

  const caseIdSet = new Set<string>();
  if (foundationIds.length > 0) {
    for (let i = 0; i < foundationIds.length; i += CHUNK) {
      const slice = foundationIds.slice(i, i + CHUNK);
      const { data: cRows, error: cErr } = await supabase
        .from("v_fi_case_foundation")
        .select("*")
        .eq("tenant_id", tid)
        .in("foundation_patient_id", slice);
      if (cErr) throw new Error(cErr.message);
      for (const row of cRows ?? []) {
        caseIdSet.add(String((row as { case_id: string }).case_id));
      }
    }
  }
  if (primaryGlobalId) {
    const extra = await fetchCasesForGlobalPatient(supabase, tid, primaryGlobalId);
    for (const id of extra) caseIdSet.add(id);
  }

  const caseIds = Array.from(caseIdSet);
  let viewCaseRows: Record<string, unknown>[] = [];
  for (let i = 0; i < caseIds.length; i += CHUNK) {
    const slice = caseIds.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data: cRows, error: cErr2 } = await supabase
      .from("v_fi_case_foundation")
      .select("*")
      .eq("tenant_id", tid)
      .in("case_id", slice);
    if (cErr2) throw new Error(cErr2.message);
    viewCaseRows = viewCaseRows.concat((cRows ?? []) as Record<string, unknown>[]);
  }
  const cases = await enrichCasesWithExternalAndNames(supabase, tid, viewCaseRows);

  const casesMissingFoundation = cases.filter((c) => !c.foundation_patient_id);
  if (casesMissingFoundation.length > 0) {
    warnings.push(
      `${casesMissingFoundation.length} case(s) in this view have no foundation_patient_id (e.g. ${casesMissingFoundation[0]?.case_id ?? "—"}).`
    );
  }

  const timeline_events: TimelineEventRow[] = [];
  const timelineById = new Map<string, TimelineEventRow>();

  const loadTimelineChunk = async (filter: { patientIds?: string[]; caseIds?: string[] }) => {
    const patientIds = filter.patientIds ?? [];
    const cids = filter.caseIds ?? [];
    if (patientIds.length === 0 && cids.length === 0) return;
    let q = supabase
      .from("fi_timeline_events")
      .select("id, case_id, patient_id, event_kind, title, detail, occurred_at, fi_event_id")
      .eq("tenant_id", tid)
      .order("occurred_at", { ascending: false })
      .limit(2000);
    if (patientIds.length > 0 && cids.length > 0) {
      q = q.or(`patient_id.in.(${patientIds.join(",")}),case_id.in.(${cids.join(",")})`);
    } else if (patientIds.length > 0) {
      q = q.in("patient_id", patientIds);
    } else {
      q = q.in("case_id", cids);
    }
    const { data: tRows, error: tErr } = await q;
    if (tErr) throw new Error(tErr.message);
    for (const row of tRows ?? []) {
      const id = String((row as { id: string }).id);
      if (timelineById.has(id)) continue;
      const detail = (row as { detail: unknown }).detail;
      timelineById.set(id, {
        id,
        case_id: String((row as { case_id: string }).case_id),
        patient_id: (row as { patient_id: string | null }).patient_id,
        event_kind: String((row as { event_kind: string }).event_kind),
        title: (row as { title: string | null }).title,
        occurred_at: String((row as { occurred_at: string }).occurred_at),
        fi_event_id: (row as { fi_event_id: string | null }).fi_event_id,
        source_system: timelineSourceFromDetail(detail),
      });
    }
  };

  await loadTimelineChunk({
    patientIds: foundationIds.length ? foundationIds : undefined,
    caseIds: caseIds.length ? caseIds : undefined,
  });

  const timeline_list = Array.from(timelineById.values()).sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  timeline_events.push(...timeline_list);

  const media_unified: UnifiedMediaRow[] = [];
  const mediaKey = new Set<string>();
  const addMedia = (row: UnifiedMediaRow) => {
    const k = `${row.media_asset_id ?? ""}:${row.legacy_upload_id ?? ""}:${row.storage_path ?? ""}`;
    if (mediaKey.has(k)) return;
    mediaKey.add(k);
    media_unified.push(row);
  };

  if (foundationIds.length > 0) {
    for (let i = 0; i < foundationIds.length; i += CHUNK) {
      const slice = foundationIds.slice(i, i + CHUNK);
      const { data: mRows, error: mErr } = await supabase
        .from("v_fi_media_unified")
        .select(
          "media_asset_id, legacy_upload_id, foundation_patient_id, case_id, source_system, asset_type, storage_path, file_name, created_at"
        )
        .eq("tenant_id", tid)
        .in("foundation_patient_id", slice);
      if (mErr) throw new Error(mErr.message);
      for (const row of mRows ?? []) {
        addMedia({
          media_asset_id: (row as { media_asset_id: string | null }).media_asset_id,
          legacy_upload_id: (row as { legacy_upload_id: string | null }).legacy_upload_id,
          foundation_patient_id: (row as { foundation_patient_id: string | null }).foundation_patient_id,
          case_id: (row as { case_id: string | null }).case_id,
          source_system: (row as { source_system: string | null }).source_system,
          asset_type: (row as { asset_type: string | null }).asset_type,
          storage_path: (row as { storage_path: string | null }).storage_path,
          file_name: (row as { file_name: string | null }).file_name,
          created_at: (row as { created_at: string | null }).created_at,
        });
      }
    }
  }
  if (caseIds.length > 0) {
    for (let i = 0; i < caseIds.length; i += CHUNK) {
      const slice = caseIds.slice(i, i + CHUNK);
      const { data: mRows, error: mErr } = await supabase
        .from("v_fi_media_unified")
        .select(
          "media_asset_id, legacy_upload_id, foundation_patient_id, case_id, source_system, asset_type, storage_path, file_name, created_at"
        )
        .eq("tenant_id", tid)
        .in("case_id", slice);
      if (mErr) throw new Error(mErr.message);
      for (const row of mRows ?? []) {
        addMedia({
          media_asset_id: (row as { media_asset_id: string | null }).media_asset_id,
          legacy_upload_id: (row as { legacy_upload_id: string | null }).legacy_upload_id,
          foundation_patient_id: (row as { foundation_patient_id: string | null }).foundation_patient_id,
          case_id: (row as { case_id: string | null }).case_id,
          source_system: (row as { source_system: string | null }).source_system,
          asset_type: (row as { asset_type: string | null }).asset_type,
          storage_path: (row as { storage_path: string | null }).storage_path,
          file_name: (row as { file_name: string | null }).file_name,
          created_at: (row as { created_at: string | null }).created_at,
        });
      }
    }
  }

  media_unified.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  const unifiedNoCase = media_unified.filter((m) => !m.case_id).length;
  if (unifiedNoCase > 0) {
    warnings.push(`${unifiedNoCase} unified media row(s) have no case_id (legacy or unlinked assets).`);
  }

  const media_assets_direct: UniversalPatientRecordResult["media_assets_direct"] = [];
  if (foundationIds.length > 0 || caseIds.length > 0) {
    if (foundationIds.length > 0) {
      for (let i = 0; i < foundationIds.length; i += CHUNK) {
        const slice = foundationIds.slice(i, i + CHUNK);
        const { data: assets, error: aErr } = await supabase
          .from("fi_media_assets")
          .select("id, case_id, patient_id, asset_type, filename, storage_path, source_system, created_at")
          .eq("tenant_id", tid)
          .in("patient_id", slice);
        if (aErr) throw new Error(aErr.message);
        for (const row of assets ?? []) {
          media_assets_direct.push({
            id: String((row as { id: string }).id),
            case_id: (row as { case_id: string | null }).case_id,
            patient_id: (row as { patient_id: string | null }).patient_id,
            asset_type: String((row as { asset_type: string }).asset_type),
            filename: String((row as { filename: string }).filename),
            storage_path: String((row as { storage_path: string }).storage_path),
            source_system: (row as { source_system: string | null }).source_system,
            created_at: String((row as { created_at: string }).created_at),
          });
        }
      }
    }
    if (caseIds.length > 0) {
      for (let i = 0; i < caseIds.length; i += CHUNK) {
        const slice = caseIds.slice(i, i + CHUNK);
        const { data: assets, error: aErr } = await supabase
          .from("fi_media_assets")
          .select("id, case_id, patient_id, asset_type, filename, storage_path, source_system, created_at")
          .eq("tenant_id", tid)
          .in("case_id", slice);
        if (aErr) throw new Error(aErr.message);
        for (const row of assets ?? []) {
          const id = String((row as { id: string }).id);
          if (media_assets_direct.some((x) => x.id === id)) continue;
          media_assets_direct.push({
            id,
            case_id: (row as { case_id: string | null }).case_id,
            patient_id: (row as { patient_id: string | null }).patient_id,
            asset_type: String((row as { asset_type: string }).asset_type),
            filename: String((row as { filename: string }).filename),
            storage_path: String((row as { storage_path: string }).storage_path),
            source_system: (row as { source_system: string | null }).source_system,
            created_at: String((row as { created_at: string }).created_at),
          });
        }
      }
    }
  }

  const directNoCase = media_assets_direct.filter((ma) => !ma.case_id).length;
  if (directNoCase > 0) {
    warnings.push(`${directNoCase} fi_media_assets row(s) have no case_id.`);
  }

  let patientOut = patient;
  if (!patientOut && resolution_rows[0]) {
    const rr = resolution_rows[0];
    patientOut = {
      foundation_patient_id: rr.foundation_patient_id,
      display_name: rr.display_name,
      email: rr.email,
      phone: rr.phone,
      primary_clinic_id: null,
      metadata: {},
      created_at: rr.created_at,
      updated_at: rr.created_at,
    };
  } else if (patientOut && resolution_rows.length > 0) {
    const rr = resolution_rows.find((r) => r.foundation_patient_id === patientOut?.foundation_patient_id) ?? resolution_rows[0];
    patientOut = {
      ...patientOut,
      display_name: patientOut.display_name ?? rr.display_name,
      email: patientOut.email ?? rr.email,
      phone: patientOut.phone ?? rr.phone,
    };
  }

  return {
    ok: true,
    tenant_id: tid,
    anchor: {
      mode: anchorMode === "person" ? "person" : anchorMode === "global_stub" ? "global_stub" : "foundation",
      primary_foundation_patient_id: primaryFoundationId,
      all_foundation_patient_ids: foundationIds,
      primary_global_patient_id: primaryGlobalId ?? linked_global_patient_ids[0] ?? null,
      person_id: explicitPerson ?? person?.person_id ?? resolution_rows.find((r) => r.person_id)?.person_id ?? null,
    },
    patient: patientOut,
    person,
    resolution_rows,
    source_identifiers,
    linked_global_patient_ids,
    cases,
    timeline_events,
    media_unified,
    media_assets_direct,
    warnings: Array.from(new Set(warnings)),
  };
}
