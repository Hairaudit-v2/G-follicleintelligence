/**
 * Stage 1I — Universal Case Record (read-only aggregate loader).
 * Uses v_fi_case_foundation, v_fi_media_unified, fi_timeline_events, fi_media_assets.
 * Service-role / server-only; does not modify ingest or dual-write paths.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enrichCasesWithExternalAndNames,
  type CaseFoundationRow,
  type PatientResolutionRow,
  type PersonSummary,
  type PatientSummary,
  type SourceIdentifierRow,
  type TimelineEventRow,
  type UnifiedMediaRow,
} from "./patientRecord";
import type { FoundationSupabase } from "./types";

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

export type CaseSourceIdentifierRow = {
  source_system: string;
  source_case_id: string;
  global_case_id: string | null;
  /** Where this row was derived from (for operators). */
  provenance: "v_fi_case_foundation" | "fi_global_cases";
};

export type ClinicSummary = {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
  metadata: Record<string, unknown>;
} | null;

export type OrganisationSummary = {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
} | null;

export type LinkedPatientBlock = {
  patient: PatientSummary;
  person: PersonSummary;
  resolution_rows: PatientResolutionRow[];
  patient_source_ids: SourceIdentifierRow[];
  global_patient_ids: string[];
};

export type LoadUniversalCaseRecordParams = {
  tenantId: string;
  caseId: string;
};

export type UniversalCaseRecordResult = {
  ok: true;
  tenant_id: string;
  case: CaseFoundationRow;
  case_source_identifiers: CaseSourceIdentifierRow[];
  linked_patient: LinkedPatientBlock | null;
  organisation: OrganisationSummary;
  clinic: ClinicSummary;
  timeline_events: TimelineEventRow[];
  media_unified: UnifiedMediaRow[];
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
  /** fi_media_assets for this case not represented in unified rows (by media_asset id). */
  media_assets_supplemental: Array<{
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

export type UniversalCaseRecordNotFound = {
  ok: false;
  error: "not_found" | "bad_request";
  message: string;
};

function readMetaString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

async function loadLinkedPatientBlock(
  supabase: SupabaseClient,
  tenantId: string,
  foundationPatientId: string
): Promise<LinkedPatientBlock> {
  const { data: pat, error: patErr } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id, primary_clinic_id, metadata, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", foundationPatientId)
    .maybeSingle();
  if (patErr) throw new Error(patErr.message);

  let patient: PatientSummary = null;
  let person: PersonSummary = null;
  const patient_source_ids: SourceIdentifierRow[] = [];

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
      .eq("tenant_id", tenantId)
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
    }
    const { data: src, error: srcErr } = await supabase
      .from("fi_patient_source_ids")
      .select("source_system, source_patient_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("patient_id", foundationPatientId);
    if (srcErr) throw new Error(srcErr.message);
    for (const row of src ?? []) {
      patient_source_ids.push({
        source_system: String((row as { source_system: string }).source_system),
        source_patient_id: String((row as { source_patient_id: string }).source_patient_id),
        created_at: String((row as { created_at: string }).created_at),
      });
    }
  }

  const { data: resData, error: resErr } = await supabase
    .from("v_fi_patient_resolution")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("foundation_patient_id", foundationPatientId);
  if (resErr) throw new Error(resErr.message);
  const resolution_rows = (resData ?? []) as unknown as PatientResolutionRow[];
  const global_patient_ids = Array.from(
    new Set(
      resolution_rows.map((r) => r.global_patient_id).filter((g): g is string => Boolean(g))
    )
  );

  if (patient && resolution_rows.length > 0) {
    const rr = resolution_rows[0];
    patient = {
      ...patient,
      display_name: patient.display_name ?? rr.display_name,
      email: patient.email ?? rr.email,
      phone: patient.phone ?? rr.phone,
    };
  }

  return { patient, person, resolution_rows, patient_source_ids, global_patient_ids };
}

/**
 * Load a read-only universal case record for FI Admin (single fi_cases.id per tenant).
 */
export async function loadUniversalCaseRecord(
  params: LoadUniversalCaseRecordParams,
  client?: FoundationSupabase
): Promise<UniversalCaseRecordResult | UniversalCaseRecordNotFound> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const caseId = params.caseId.trim();
  if (!tid || !caseId) {
    return { ok: false, error: "bad_request", message: "Missing tenantId or caseId." };
  }

  const { data: viewRow, error: vErr } = await supabase
    .from("v_fi_case_foundation")
    .select("*")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!viewRow) {
    return { ok: false, error: "not_found", message: "Case not found for tenant." };
  }

  const [caseSummary] = await enrichCasesWithExternalAndNames(supabase, tid, [viewRow as Record<string, unknown>]);
  const warnings: string[] = [];

  const case_source_identifiers: CaseSourceIdentifierRow[] = [];
  if (caseSummary.source_system && caseSummary.source_case_id) {
    case_source_identifiers.push({
      source_system: caseSummary.source_system,
      source_case_id: caseSummary.source_case_id,
      global_case_id: caseSummary.global_case_id,
      provenance: "v_fi_case_foundation",
    });
  }

  const { data: gcRows, error: gcErr } = await supabase
    .from("fi_global_cases")
    .select("id, source_system, source_case_id")
    .eq("tenant_id", tid)
    .eq("fi_case_id", caseId);
  if (gcErr) throw new Error(gcErr.message);
  const seen = new Set(
    case_source_identifiers.map((r) => `${r.source_system}:${r.source_case_id}`)
  );
  for (const row of gcRows ?? []) {
    const source_system = String((row as { source_system: string }).source_system);
    const source_case_id = String((row as { source_case_id: string }).source_case_id);
    const k = `${source_system}:${source_case_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    case_source_identifiers.push({
      source_system,
      source_case_id,
      global_case_id: String((row as { id: string }).id),
      provenance: "fi_global_cases",
    });
  }

  if (!caseSummary.foundation_patient_id) {
    warnings.push("No foundation_patient_id on this case (foundation layer link missing).");
  }
  if (!caseSummary.source_case_id) {
    warnings.push("No source_case_id in case foundation view (metadata or global bridge may be incomplete).");
  }
  if (!caseSummary.clinic_id) {
    warnings.push("No clinic_id on this case.");
  }

  let organisation: OrganisationSummary = null;
  if (caseSummary.organisation_id) {
    const { data: org, error: oErr } = await supabase
      .from("fi_organisations")
      .select("id, name, metadata")
      .eq("tenant_id", tid)
      .eq("id", caseSummary.organisation_id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (org) {
      organisation = {
        id: String((org as { id: string }).id),
        name: String((org as { name: string }).name),
        metadata: ((org as { metadata: unknown }).metadata as Record<string, unknown>) ?? {},
      };
    }
  }

  let clinic: ClinicSummary = null;
  if (caseSummary.clinic_id) {
    const { data: cl, error: cErr } = await supabase
      .from("fi_clinics")
      .select("id, display_name, metadata")
      .eq("tenant_id", tid)
      .eq("id", caseSummary.clinic_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (cl) {
      const meta = ((cl as { metadata: unknown }).metadata as Record<string, unknown>) ?? {};
      clinic = {
        id: String((cl as { id: string }).id),
        display_name: String((cl as { display_name: string }).display_name),
        city: readMetaString(meta, "city", "locality"),
        country: readMetaString(meta, "country", "country_code"),
        metadata: meta,
      };
    }
  }

  let linked_patient: LinkedPatientBlock | null = null;
  if (caseSummary.foundation_patient_id) {
    linked_patient = await loadLinkedPatientBlock(supabase, tid, caseSummary.foundation_patient_id);
    if (!linked_patient.patient) {
      warnings.push(
        "foundation_patient_id is set on the case but no fi_patients row was loaded (data inconsistency)."
      );
    }
    if (linked_patient.patient && !linked_patient.person?.person_id) {
      warnings.push("Linked patient has no resolved fi_persons row (person_id missing or orphaned).");
    }
  }

  const { data: tRows, error: tErr } = await supabase
    .from("fi_timeline_events")
    .select("id, case_id, patient_id, event_kind, title, detail, occurred_at, fi_event_id")
    .eq("tenant_id", tid)
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: false })
    .limit(2000);
  if (tErr) throw new Error(tErr.message);

  const timeline_events: TimelineEventRow[] = (tRows ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    case_id: String((row as { case_id: string }).case_id),
    patient_id: (row as { patient_id: string | null }).patient_id,
    event_kind: String((row as { event_kind: string }).event_kind),
    title: (row as { title: string | null }).title,
    occurred_at: String((row as { occurred_at: string }).occurred_at),
    fi_event_id: (row as { fi_event_id: string | null }).fi_event_id,
    source_system: timelineSourceFromDetail((row as { detail: unknown }).detail),
  }));

  if (timeline_events.length === 0) {
    warnings.push("No fi_timeline_events rows for this case yet.");
  }

  const { data: mUnified, error: mErr } = await supabase
    .from("v_fi_media_unified")
    .select(
      "media_asset_id, legacy_upload_id, foundation_patient_id, case_id, source_system, asset_type, storage_path, file_name, created_at"
    )
    .eq("tenant_id", tid)
    .eq("case_id", caseId);
  if (mErr) throw new Error(mErr.message);

  const media_unified: UnifiedMediaRow[] = (mUnified ?? []).map((row) => ({
    media_asset_id: (row as { media_asset_id: string | null }).media_asset_id,
    legacy_upload_id: (row as { legacy_upload_id: string | null }).legacy_upload_id,
    foundation_patient_id: (row as { foundation_patient_id: string | null }).foundation_patient_id,
    case_id: (row as { case_id: string | null }).case_id,
    source_system: (row as { source_system: string | null }).source_system,
    asset_type: (row as { asset_type: string | null }).asset_type,
    storage_path: (row as { storage_path: string | null }).storage_path,
    file_name: (row as { file_name: string | null }).file_name,
    created_at: (row as { created_at: string | null }).created_at,
  }));

  const unifiedAssetIds = new Set(
    media_unified.map((m) => m.media_asset_id).filter((id): id is string => Boolean(id))
  );

  const { data: mAssets, error: aErr } = await supabase
    .from("fi_media_assets")
    .select("id, case_id, patient_id, asset_type, filename, storage_path, source_system, created_at")
    .eq("tenant_id", tid)
    .eq("case_id", caseId);
  if (aErr) throw new Error(aErr.message);

  const media_assets_direct: UniversalCaseRecordResult["media_assets_direct"] = [];
  const media_assets_supplemental: UniversalCaseRecordResult["media_assets_supplemental"] = [];

  for (const row of mAssets ?? []) {
    const id = String((row as { id: string }).id);
    const rec = {
      id,
      case_id: (row as { case_id: string | null }).case_id,
      patient_id: (row as { patient_id: string | null }).patient_id,
      asset_type: String((row as { asset_type: string }).asset_type),
      filename: String((row as { filename: string }).filename),
      storage_path: String((row as { storage_path: string }).storage_path),
      source_system: (row as { source_system: string | null }).source_system,
      created_at: String((row as { created_at: string }).created_at),
    };
    media_assets_direct.push(rec);
    if (!unifiedAssetIds.has(id)) {
      media_assets_supplemental.push(rec);
    }
  }

  const unifiedMissingPatient = media_unified.filter((m) => !m.foundation_patient_id).length;
  const assetsMissingPatient = media_assets_direct.filter((m) => !m.patient_id).length;
  if (unifiedMissingPatient + assetsMissingPatient > 0) {
    warnings.push(
      `${unifiedMissingPatient} unified media row(s) and ${assetsMissingPatient} fi_media_assets row(s) lack patient linkage for this case.`
    );
  }

  return {
    ok: true,
    tenant_id: tid,
    case: caseSummary,
    case_source_identifiers,
    linked_patient,
    organisation,
    clinic,
    timeline_events,
    media_unified,
    media_assets_direct,
    media_assets_supplemental,
    warnings: Array.from(new Set(warnings)),
  };
}
