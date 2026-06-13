/**
 * PatientTwin V1 loader — **read model only** (service-role Supabase).
 *
 * Assembles the twin from existing foundation/CRM/case/audit/media/timeline sources. Does not
 * write or replace authoritative tables. Partial failures surface as `warnings` rather than
 * thrown errors where practical; invariant violations (e.g. DTO schema mismatch) still throw.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadUniversalPatientRecord,
  type UniversalPatientRecordResult,
} from "@/src/lib/fi/foundation/patientRecord";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { calculatePatientTwinCompleteness, type PatientTwinV1ForCompleteness } from "./patientTwinCompleteness";
import { buildPatientJourneyGallery, buildTwinImagingUiSections } from "./patientJourneyGallery";
import { patientTwinV1Schema } from "./patientTwinSchema";
import {
  loadActiveTherapyPlanSummary,
  loadPatientTherapyEventsForPatient,
} from "@/src/lib/medicationOs/medicationOsLoaders.server";
import { normalizeImagingLibraryAxis } from "@/src/lib/patientImages/patientImagePolicy";
import { loadPatientTwinPhotoProtocolSection } from "@/src/lib/hair-intelligence/photoProtocols/photoProtocolLoader.server";
import { loadPatientTwinImagingGallerySection } from "@/src/lib/patientTwin/patientTwinImagingGallery.server";
import { loadPatientTwinDonorSection } from "@/src/lib/patientTwin/patientTwinDonorIntelligence.server";
import { loadPatientTwinHairLossSection } from "@/src/lib/patientTwin/patientTwinHairLossClassification.server";
import {
  emptyPatientTwinHairProgressionIntelligence,
  loadPatientTwinHairProgressionSection,
} from "@/src/lib/patientTwin/patientTwinHairProgression.server";
import {
  buildPatientTwinMedicationsSection,
  emptyPatientTwinMedicationsSection,
  PATIENT_TWIN_MEDICATION_OS_EVENTS_READ_CAP,
} from "./patientTwinMedicationOs";
import {
  PATIENT_TWIN_LOADER_VERSION,
  PATIENT_TWIN_VERSION,
  type PatientTwinV1,
  type PatientTwinCaseMilestone,
  type PatientTwinCaseRow,
  type PatientTwinImagingSection,
  type PatientTwinMediaLatestItem,
  type PatientTwinMediaSection,
  type PatientTwinTimelineItem,
  type PatientTwinWarning,
  type PatientTwinWarningCode,
} from "./patientTwinTypes";

const CHUNK = 400;
const TIMELINE_CAP = 100;

const SOURCE_VIEWS_USED = [
  "v_fi_patient_resolution",
  "v_fi_case_foundation",
  "v_fi_media_unified",
] as const;

const SOURCE_TABLES_USED = [
  "fi_patients",
  "fi_persons",
  "fi_patient_source_ids",
  "fi_global_patients",
  "fi_global_cases",
  "fi_cases",
  "fi_timeline_events",
  "fi_crm_leads",
  "fi_crm_tasks",
  "fi_crm_activity_events",
  "fi_crm_pipeline_stages",
  "fi_users",
  "fi_clinics",
  "fi_organisations",
  "fi_reports",
  "fi_audits",
  "fi_model_runs",
  "fi_scorecards",
  "fi_patient_clinical_details",
  "fi_pathology_requests",
  "fi_pathology_results",
  "fi_pathology_result_items",
  "fi_pathology_ai_interpretations",
  "fi_patient_images",
  "hli_image_classifications",
  "hli_photo_protocol_templates",
  "hli_photo_protocol_slots",
  "hli_photo_protocol_sessions",
  "hli_photo_protocol_session_slots",
  "fi_medication_os_canonical",
  "fi_patient_therapy_plans",
  "fi_patient_therapy_plan_items",
  "fi_patient_therapy_events",
  "hair_intelligence_hair_loss_classifications",
  "hair_intelligence_donor_assessments",
  "hair_intelligence_progression_network_buckets",
] as const;

const CRM_TERMINAL_LEAD_STATUSES = new Set(["converted", "archived", "lost"]);

function emptyTwinImagingGalleryShell(): PatientTwinImagingSection["gallery"] {
  const j = buildPatientJourneyGallery([]);
  return {
    items: [],
    ui_sections: buildTwinImagingUiSections(j).map((s) => ({ key: s.key, title: s.title, items: [] })),
  };
}

function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id && typeof id === "string") {
      const t = id.trim();
      if (t) s.add(t);
    }
  }
  return Array.from(s);
}

function pushWarning(out: PatientTwinWarning[], code: PatientTwinWarningCode, message: string) {
  out.push({ code, message });
}

function mapLegacyWarnings(messages: string[], out: PatientTwinWarning[]) {
  for (const m of messages) {
    if (!m.trim()) continue;
    let code: PatientTwinWarningCode = "generic";
    if (m.includes("no foundation patient") || m.includes("No foundation patient")) {
      code = "missing_foundation_patient";
    } else if (m.includes("Global patient") && m.includes("no foundation_patient_id")) {
      code = "unresolved_global_patient";
    } else if (m.includes("Multiple resolution rows") || m.includes("Multiple fi_patients rows share")) {
      code = "resolution_anomaly";
    } else if (m.includes("unified media row") || m.includes("fi_media_assets row")) {
      code = "duplicate_media_risk";
    }
    pushWarning(out, code, m);
  }
}

function buildMediaSection(rows: UniversalPatientRecordResult["media_unified"]): PatientTwinMediaSection {
  const by_asset_type: PatientTwinMediaSection["by_asset_type"] = {};
  const sorted = [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  for (const row of sorted) {
    const key = (row.asset_type && row.asset_type.trim()) || "unknown";
    if (!by_asset_type[key]) {
      by_asset_type[key] = { count: 0, latest: null };
    }
    const bucket = by_asset_type[key];
    bucket.count += 1;
    if (!bucket.latest) {
      const latest: PatientTwinMediaLatestItem = {
        asset_type: row.asset_type,
        media_asset_id: row.media_asset_id,
        legacy_upload_id: row.legacy_upload_id,
        case_id: row.case_id,
        file_name: row.file_name,
        created_at: row.created_at,
      };
      bucket.latest = latest;
    }
  }
  return { by_asset_type };
}

function buildFoundationTimeline(base: UniversalPatientRecordResult): PatientTwinTimelineItem[] {
  const cap = Math.min(TIMELINE_CAP, base.timeline_events.length);
  const newest = base.timeline_events.slice(0, cap);
  const items: PatientTwinTimelineItem[] = newest.map((ev) => ({
    source_type: "fi_timeline_events",
    source_id: ev.id,
    occurred_at: ev.occurred_at,
    event_kind: ev.event_kind,
    title: ev.title,
    case_id: ev.case_id,
    patient_id: ev.patient_id,
  }));
  return items;
}

function latestMilestoneByCaseId(base: UniversalPatientRecordResult): Map<string, PatientTwinCaseMilestone> {
  const map = new Map<string, PatientTwinCaseMilestone>();
  for (const ev of base.timeline_events) {
    const cid = ev.case_id;
    if (!cid || map.has(cid)) continue;
    map.set(cid, {
      event_kind: ev.event_kind,
      title: ev.title,
      occurred_at: ev.occurred_at,
    });
  }
  return map;
}

async function sumCountForCases(
  supabase: SupabaseClient,
  table: "fi_reports" | "fi_audits" | "fi_model_runs" | "fi_scorecards",
  tenantId: string,
  caseIds: string[]
): Promise<number> {
  if (caseIds.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < caseIds.length; i += CHUNK) {
    const slice = caseIds.slice(i, i + CHUNK);
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("case_id", slice);
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }
  return total;
}

async function aggregateStatusForCases(
  supabase: SupabaseClient,
  table: "fi_reports" | "fi_model_runs",
  tenantId: string,
  caseIds: string[],
  column: "status"
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (caseIds.length === 0) return out;
  for (let i = 0; i < caseIds.length; i += CHUNK) {
    const slice = caseIds.slice(i, i + CHUNK);
    const { data, error } = await supabase.from(table).select(column).eq("tenant_id", tenantId).in("case_id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const st = String(r[column] ?? "unknown");
      out[st] = (out[st] ?? 0) + 1;
    }
  }
  return out;
}

async function loadLatestReleasedReport(
  supabase: SupabaseClient,
  tenantId: string,
  caseIds: string[]
): Promise<PatientTwinV1["audits"]["latest_released_report"]> {
  if (caseIds.length === 0) return null;
  type Cand = NonNullable<PatientTwinV1["audits"]["latest_released_report"]>;
  let best: Cand | null = null;
  let bestTs = 0;
  for (let i = 0; i < caseIds.length; i += CHUNK) {
    const slice = caseIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("fi_reports")
      .select("id, case_id, version, released_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "released")
      .in("case_id", slice)
      .order("released_at", { ascending: false, nullsFirst: false })
      .limit(25);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        case_id: string;
        version: number;
        released_at: string | null;
        created_at: string;
      };
      const t = r.released_at ? new Date(r.released_at).getTime() : new Date(r.created_at).getTime();
      if (!best || t > bestTs) {
        best = {
          report_id: String(r.id),
          case_id: String(r.case_id),
          version: Number(r.version),
          released_at: r.released_at != null ? String(r.released_at) : null,
          created_at: String(r.created_at),
        };
        bestTs = t;
      }
    }
  }
  return best;
}

export type LoadPatientTwinV1Params = {
  tenantId: string;
  /** Foundation `fi_patients.id` for this tenant. */
  foundationPatientId: string;
  client?: SupabaseClient;
};

/**
 * Loads PatientTwin V1 for a foundation patient. Returns `null` when the patient row does not
 * exist in the tenant (caller should map to HTTP 404).
 */
export async function loadPatientTwinV1(params: LoadPatientTwinV1Params): Promise<PatientTwinV1 | null> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.foundationPatientId.trim();
  if (!tid || !pid) return null;

  const base = await loadUniversalPatientRecord({ tenantId: tid, foundationPatientId: pid }, supabase);
  if (!base.ok) {
    if (base.error === "not_found") return null;
    throw new Error(base.message);
  }

  const warnings: PatientTwinWarning[] = [];
  mapLegacyWarnings(base.warnings, warnings);

  const foundationIds = base.anchor.all_foundation_patient_ids;
  const primaryFoundation = base.anchor.primary_foundation_patient_id ?? pid;
  const caseIds = uniqueStrings(base.cases.map((c) => c.case_id));

  if (caseIds.length === 0) {
    pushWarning(warnings, "missing_case_linkage", "No fi_cases linked for this foundation patient in this tenant.");
  }

  const milestoneByCase = latestMilestoneByCaseId(base);

  const casesOut: PatientTwinCaseRow[] = base.cases.map((c) => ({
    case_id: c.case_id,
    global_case_id: c.global_case_id,
    foundation_patient_id: c.foundation_patient_id,
    global_patient_id: c.global_patient_id,
    status: c.status,
    case_type: c.case_type,
    created_at: c.created_at,
    updated_at: c.updated_at,
    clinic_display_name: c.clinic_display_name,
    organisation_name: c.organisation_name,
    latest_milestone: milestoneByCase.get(c.case_id) ?? null,
  }));

  const personMeta =
    base.person && typeof base.person.metadata === "object" && !Array.isArray(base.person.metadata)
      ? (base.person.metadata as Record<string, unknown>)
      : {};
  const patientMeta =
    base.patient && typeof base.patient.metadata === "object" && !Array.isArray(base.patient.metadata)
      ? (base.patient.metadata as Record<string, unknown>)
      : {};

  const personIdForHub = base.person?.person_id ?? base.anchor.person_id ?? null;

  const patPrefsRes = await supabase
    .from("fi_patients")
    .select("preferred_contact_method, reminder_consent")
    .eq("tenant_id", tid)
    .eq("id", primaryFoundation)
    .maybeSingle();
  if (patPrefsRes.error) {
    pushWarning(warnings, "generic", `Patient preferences lookup skipped: ${patPrefsRes.error.message}`);
  }

  let hubspotSourcePersonId: string | null = null;
  if (personIdForHub) {
    const hubspotPersonSrcRes = await supabase
      .from("fi_person_source_ids")
      .select("source_person_id")
      .eq("tenant_id", tid)
      .eq("person_id", personIdForHub)
      .eq("source_system", "hubspot")
      .maybeSingle();
    if (hubspotPersonSrcRes.error) {
      pushWarning(warnings, "generic", `HubSpot person source id lookup skipped: ${hubspotPersonSrcRes.error.message}`);
    } else if (hubspotPersonSrcRes.data) {
      hubspotSourcePersonId = String((hubspotPersonSrcRes.data as { source_person_id: string }).source_person_id);
    }
  }

  const prefs = patPrefsRes.data as { preferred_contact_method?: unknown; reminder_consent?: boolean | null } | null;

  const idc = derivePatientIdentityContact({
    personMetadata: personMeta,
    patientMetadata: patientMeta,
    preferredContactMethod: prefs?.preferred_contact_method != null ? String(prefs.preferred_contact_method) : null,
    reminderConsent: prefs?.reminder_consent ?? null,
    hubspotSourcePersonId,
  });

  const display_name =
    (idc.fullName !== "—" ? idc.fullName : null) ??
    (base.patient?.display_name?.trim() ? base.patient.display_name.trim() : null) ??
    (base.resolution_rows[0]?.display_name?.trim() ? base.resolution_rows[0]!.display_name!.trim() : null) ??
    null;
  const email = idc.primaryEmail ?? base.resolution_rows[0]?.email ?? null;
  const phone = idc.primaryPhone ?? base.resolution_rows[0]?.phone ?? null;
  const date_of_birth = idc.dateOfBirth;

  const source_labels = uniqueStrings([
    ...base.resolution_rows.map((r) => r.source_system),
    ...base.source_identifiers.map((s) => s.source_system),
  ]);

  const duplicate_risk = base.warnings.some(
    (w) =>
      w.includes("Multiple resolution rows") ||
      w.includes("Multiple fi_patients rows share") ||
      w.includes("unified media row") ||
      w.includes("fi_media_assets row")
  );

  const resolution_warnings = base.resolution_rows
    .filter((r) => r.global_patient_id && !r.foundation_patient_id)
    .map(
      (r) =>
        `Global patient ${r.global_patient_id} (${r.source_system}:${r.source_patient_id}) has no foundation_patient_id.`
    );

  const identity_resolution: PatientTwinV1["identity_resolution"] = {
    foundation_patient_id: primaryFoundation,
    global_patient_id: base.anchor.primary_global_patient_id ?? base.linked_global_patient_ids[0] ?? null,
    source_ids: base.source_identifiers.map((s) => ({
      source_system: s.source_system,
      source_patient_id: s.source_patient_id,
    })),
    duplicate_risk,
    resolution_warnings,
  };

  const orParts: string[] = [];
  if (foundationIds.length) {
    orParts.push(`patient_id.in.(${foundationIds.join(",")})`);
  }
  if (caseIds.length) {
    orParts.push(`case_id.in.(${caseIds.join(",")})`);
    orParts.push(`converted_case_id.in.(${caseIds.join(",")})`);
  }

  const leadsRaw: Record<string, unknown>[] = [];
  if (orParts.length) {
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select(
        "id, status, current_stage_id, updated_at, created_at, primary_owner_user_id, clinic_id, organisation_id, summary"
      )
      .eq("tenant_id", tid)
      .or(orParts.join(","));
    if (error) {
      pushWarning(warnings, "generic", `CRM leads query skipped: ${error.message}`);
    } else {
      const seen = new Set<string>();
      for (const row of data ?? []) {
        const id = String((row as { id: string }).id);
        if (seen.has(id)) continue;
        seen.add(id);
        leadsRaw.push(row as Record<string, unknown>);
      }
    }
  }

  const leadsMapped = leadsRaw.map((row) => ({
    id: String(row.id),
    status: String(row.status ?? "unknown"),
    current_stage_id: row.current_stage_id != null ? String(row.current_stage_id) : null,
    updated_at: String(row.updated_at ?? row.created_at),
    created_at: String(row.created_at),
    primary_owner_user_id: row.primary_owner_user_id != null ? String(row.primary_owner_user_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    organisation_id: row.organisation_id != null ? String(row.organisation_id) : null,
    summary: row.summary != null ? String(row.summary) : null,
  }));

  const active_leads_count = leadsMapped.filter((l) => !CRM_TERMINAL_LEAD_STATUSES.has(l.status.toLowerCase())).length;

  const leadsSorted = [...leadsMapped].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const latestLead = leadsSorted[0] ?? null;

  const stageIds = uniqueStrings(leadsMapped.map((l) => l.current_stage_id));
  const stageLabelById = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages, error: se } = await supabase
      .from("fi_crm_pipeline_stages")
      .select("id, label")
      .eq("tenant_id", tid)
      .in("id", stageIds);
    if (se) {
      pushWarning(warnings, "generic", `CRM pipeline stages lookup skipped: ${se.message}`);
    } else {
      for (const s of stages ?? []) {
        stageLabelById.set(String((s as { id: string }).id), String((s as { label: string }).label));
      }
    }
  }

  let open_tasks_count = 0;
  const leadIds = leadsMapped.map((l) => l.id);
  if (leadIds.length) {
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const slice = leadIds.slice(i, i + CHUNK);
      const { count, error: te } = await supabase
        .from("fi_crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .in("lead_id", slice)
        .is("completed_at", null);
      if (te) {
        pushWarning(warnings, "generic", `CRM open task count skipped: ${te.message}`);
        break;
      }
      open_tasks_count += count ?? 0;
    }
  }

  let latest_activity_summary: string | null = null;
  if (orParts.length) {
    const { data: act, error: ae } = await supabase
      .from("fi_crm_activity_events")
      .select("activity_kind, title, occurred_at")
      .eq("tenant_id", tid)
      .or(orParts.join(","))
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ae) {
      pushWarning(warnings, "generic", `CRM latest activity skipped: ${ae.message}`);
    } else if (act) {
      const ak = String((act as { activity_kind: string }).activity_kind);
      const tl = (act as { title: string | null }).title;
      latest_activity_summary = tl && tl.trim() ? `${ak}: ${tl}` : ak;
    }
  }

  let primary_owner_email: string | null = null;
  let primary_clinic_display_name: string | null = null;
  let primary_organisation_name: string | null = null;
  if (latestLead?.primary_owner_user_id) {
    const { data: u, error: ue } = await supabase
      .from("fi_users")
      .select("email")
      .eq("tenant_id", tid)
      .eq("id", latestLead.primary_owner_user_id)
      .maybeSingle();
    if (!ue && u) {
      primary_owner_email = (u as { email: string | null }).email != null ? String((u as { email: string | null }).email) : null;
    }
  }
  if (latestLead?.clinic_id) {
    const { data: cl, error: cle } = await supabase
      .from("fi_clinics")
      .select("display_name")
      .eq("tenant_id", tid)
      .eq("id", latestLead.clinic_id)
      .maybeSingle();
    if (!cle && cl) {
      primary_clinic_display_name = String((cl as { display_name: string }).display_name);
    }
  }
  if (latestLead?.organisation_id) {
    const { data: org, error: oe } = await supabase
      .from("fi_organisations")
      .select("name")
      .eq("tenant_id", tid)
      .eq("id", latestLead.organisation_id)
      .maybeSingle();
    if (!oe && org) {
      primary_organisation_name = String((org as { name: string }).name);
    }
  }

  const crm: PatientTwinV1["crm"] = {
    active_leads_count,
    latest_lead_status: latestLead?.status ?? null,
    latest_lead_stage_label: latestLead?.current_stage_id
      ? stageLabelById.get(latestLead.current_stage_id) ?? null
      : null,
    open_tasks_count,
    latest_activity_summary,
    primary_owner_email,
    primary_clinic_display_name,
    primary_organisation_name,
  };

  let reports_total = 0;
  let audits_total = 0;
  let model_runs_total = 0;
  let scorecards_total = 0;
  let reports_by_status: Record<string, number> = {};
  let model_runs_by_status: Record<string, number> = {};
  let latest_released_report: PatientTwinV1["audits"]["latest_released_report"] = null;

  if (caseIds.length > 0) {
    const [repTot, audTot, runTot, scoreTot, repBySt, runBySt, released] = await Promise.all([
      sumCountForCases(supabase, "fi_reports", tid, caseIds),
      sumCountForCases(supabase, "fi_audits", tid, caseIds),
      sumCountForCases(supabase, "fi_model_runs", tid, caseIds),
      sumCountForCases(supabase, "fi_scorecards", tid, caseIds),
      aggregateStatusForCases(supabase, "fi_reports", tid, caseIds, "status"),
      aggregateStatusForCases(supabase, "fi_model_runs", tid, caseIds, "status"),
      loadLatestReleasedReport(supabase, tid, caseIds),
    ]);
    reports_total = repTot;
    audits_total = audTot;
    model_runs_total = runTot;
    scorecards_total = scoreTot;
    reports_by_status = repBySt;
    model_runs_by_status = runBySt;
    latest_released_report = released;
  }

  if (caseIds.length > 0 && reports_total === 0 && audits_total === 0) {
    pushWarning(
      warnings,
      "missing_audit_linkage",
      "Linked cases have no fi_reports or fi_audits rows in this tenant (audit pipeline may not have run)."
    );
  }

  const audits: PatientTwinV1["audits"] = {
    reports_total,
    audits_total,
    reports_by_status,
    model_runs_total,
    model_runs_by_status,
    scorecards_total,
    latest_released_report,
    outcome_indicators: { placeholder: true },
  };

  const media = buildMediaSection(base.media_unified);

  const imagingWorkspaceHref = `/fi-admin/${encodeURIComponent(tid)}/patients/${encodeURIComponent(primaryFoundation)}/imaging`;
  let imaging: PatientTwinImagingSection = {
    active_image_total: 0,
    by_library_axis: {},
    latest_captured_at: null,
    imaging_workspace_href: imagingWorkspaceHref,
    gallery: emptyTwinImagingGalleryShell(),
  };

  const { data: imgTwinRows, error: imgTwinErr } = await supabase
    .from("fi_patient_images")
    .select("imaging_library_axis, taken_at, created_at")
    .eq("tenant_id", tid)
    .eq("patient_id", primaryFoundation)
    .eq("image_status", "active");
  if (imgTwinErr) {
    const m = imgTwinErr.message ?? "";
    if (!m.includes("does not exist") && !m.includes("schema cache")) {
      pushWarning(warnings, "generic", `Imaging twin section skipped: ${m}`);
    }
  } else if (imgTwinRows) {
    const by_library_axis: Record<string, number> = {};
    let latest_captured_at: string | null = null;
    for (const raw of imgTwinRows) {
      const r = raw as Record<string, unknown>;
      const axis = normalizeImagingLibraryAxis(r.imaging_library_axis);
      by_library_axis[axis] = (by_library_axis[axis] ?? 0) + 1;
      const ts = (r.taken_at != null ? String(r.taken_at) : String(r.created_at ?? "")).trim();
      if (ts && (!latest_captured_at || ts > latest_captured_at)) {
        latest_captured_at = ts;
      }
    }
    imaging = {
      active_image_total: imgTwinRows.length,
      by_library_axis,
      latest_captured_at,
      imaging_workspace_href: imagingWorkspaceHref,
      gallery: emptyTwinImagingGalleryShell(),
    };
  }

  try {
    const gallery = await loadPatientTwinImagingGallerySection(tid, primaryFoundation, supabase);
    imaging = { ...imaging, gallery };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushWarning(warnings, "generic", `Imaging AI gallery skipped: ${msg}`);
  }

  let photo_protocol: PatientTwinV1["photo_protocol"] = null;
  try {
    photo_protocol = await loadPatientTwinPhotoProtocolSection({
      tenantId: tid,
      patientId: primaryFoundation,
      galleryItems: imaging.gallery.items,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      pushWarning(warnings, "generic", `Photo protocol section skipped: ${msg}`);
    }
  }

  let hair_loss: PatientTwinV1["intelligence"]["hair_loss"] = {
    latest: null,
    recent: [],
    recent_cap: 5,
  };
  try {
    hair_loss = await loadPatientTwinHairLossSection(tid, primaryFoundation, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      pushWarning(warnings, "generic", `Hair loss classification section skipped: ${msg}`);
    }
  }

  let donor: PatientTwinV1["intelligence"]["donor"] = {
    latest: null,
    recent: [],
    recent_cap: 5,
  };
  try {
    donor = await loadPatientTwinDonorSection(tid, primaryFoundation, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      pushWarning(warnings, "generic", `Donor intelligence section skipped: ${msg}`);
    }
  }

  let hair_progression: PatientTwinV1["intelligence"]["hair_progression"] = emptyPatientTwinHairProgressionIntelligence();
  try {
    hair_progression = await loadPatientTwinHairProgressionSection(tid, primaryFoundation, {
      patientDateOfBirthIso: date_of_birth,
      patientSexClassification: null,
    }, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
      pushWarning(warnings, "generic", `Hair progression intelligence skipped: ${msg}`);
    }
  }

  const timelineItems = buildFoundationTimeline(base);

  const pathologyCap = 12;
  const pathologyResultsCap = 12;
  let pathology: PatientTwinV1["pathology"] = {
    requests: [],
    results: [],
    item_cap: pathologyCap,
    results_item_cap: pathologyResultsCap,
    abnormal_markers_total: 0,
    last_result_reviewed_at: null,
    latest_ai_interpretation: null,
  };

  const { data: pthRows, error: pthErr } = await supabase
    .from("fi_pathology_requests")
    .select("id, request_date, template_used, status, emailed_to_patient_at, cancelled_at, created_at")
    .eq("tenant_id", tid)
    .eq("patient_id", primaryFoundation)
    .order("created_at", { ascending: false })
    .limit(pathologyCap);
  if (pthErr) {
    pushWarning(warnings, "generic", `Pathology requests section skipped: ${pthErr.message}`);
  } else {
    pathology = {
      ...pathology,
      item_cap: pathologyCap,
      requests: (pthRows ?? []).map((r) => {
        const x = r as Record<string, unknown>;
        return {
          id: String(x.id),
          request_date: String(x.request_date ?? "").slice(0, 10),
          template_used: String(x.template_used ?? ""),
          status: String(x.status ?? ""),
          emailed_to_patient_at: x.emailed_to_patient_at != null ? String(x.emailed_to_patient_at) : null,
          cancelled_at: x.cancelled_at != null ? String(x.cancelled_at) : null,
          created_at: String(x.created_at ?? ""),
        };
      }),
    };
  }

  const { data: prRows, error: prErr } = await supabase
    .from("fi_pathology_results")
    .select("id, result_date, provider_name, status, pathology_request_id, source_type, reviewed_at, created_at")
    .eq("tenant_id", tid)
    .eq("patient_id", primaryFoundation)
    .order("created_at", { ascending: false })
    .limit(pathologyResultsCap);
  if (prErr) {
    pushWarning(warnings, "generic", `Pathology results section skipped: ${prErr.message}`);
  } else {
    const resultIds = (prRows ?? []).map((r) => String((r as Record<string, unknown>).id));
    const markerCountByResult = new Map<string, number>();
    const abnormalByResult = new Map<string, number>();
    if (resultIds.length > 0) {
      const { data: itRows, error: itErr } = await supabase
        .from("fi_pathology_result_items")
        .select("result_id, flag")
        .eq("tenant_id", tid)
        .in("result_id", resultIds);
      if (itErr) {
        pushWarning(warnings, "generic", `Pathology result markers skipped: ${itErr.message}`);
      } else {
        for (const raw of itRows ?? []) {
          const x = raw as Record<string, unknown>;
          const rid = String(x.result_id);
          markerCountByResult.set(rid, (markerCountByResult.get(rid) ?? 0) + 1);
          const fl = String(x.flag ?? "");
          if (fl === "low" || fl === "high" || fl === "critical") {
            abnormalByResult.set(rid, (abnormalByResult.get(rid) ?? 0) + 1);
          }
        }
      }
    }

    const results = (prRows ?? []).map((r) => {
      const x = r as Record<string, unknown>;
      const id = String(x.id);
      return {
        id,
        result_date: String(x.result_date ?? "").slice(0, 10),
        provider_name: x.provider_name != null ? String(x.provider_name) : null,
        status: String(x.status ?? ""),
        pathology_request_id: x.pathology_request_id != null ? String(x.pathology_request_id) : null,
        marker_count: markerCountByResult.get(id) ?? 0,
        abnormal_marker_count: abnormalByResult.get(id) ?? 0,
        source_type: String(x.source_type ?? ""),
        reviewed_at: x.reviewed_at != null ? String(x.reviewed_at) : null,
        created_at: String(x.created_at ?? ""),
      };
    });

    let abnormal_markers_total = 0;
    let last_result_reviewed_at: string | null = null;
    for (const row of results) {
      abnormal_markers_total += row.abnormal_marker_count;
      if (row.reviewed_at) {
        if (!last_result_reviewed_at || row.reviewed_at > last_result_reviewed_at) {
          last_result_reviewed_at = row.reviewed_at;
        }
      }
    }

    pathology = {
      ...pathology,
      results_item_cap: pathologyResultsCap,
      results,
      abnormal_markers_total,
      last_result_reviewed_at,
    };
  }

  const { data: aiRow, error: aiErr } = await supabase
    .from("fi_pathology_ai_interpretations")
    .select("id, pathology_result_id, status, hair_loss_relevance_score, surgical_readiness_score, interpretation_json, created_at, reviewed_at")
    .eq("tenant_id", tid)
    .eq("patient_id", primaryFoundation)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aiErr) {
    pushWarning(warnings, "generic", `Pathology AI interpretation skipped: ${aiErr.message}`);
  } else if (aiRow) {
    const x = aiRow as Record<string, unknown>;
    const blob =
      x.interpretation_json && typeof x.interpretation_json === "object" && !Array.isArray(x.interpretation_json)
        ? (x.interpretation_json as Record<string, unknown>)
        : {};
    const contributorsRaw = Array.isArray(blob.likely_contributors) ? blob.likely_contributors : [];
    const main_contributors = contributorsRaw
      .map((c) => {
        if (typeof c === "string") return c.trim();
        if (c && typeof c === "object" && !Array.isArray(c)) {
          const name = (c as Record<string, unknown>).name;
          return typeof name === "string" ? name.trim() : "";
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 3);
    const overviewRaw = typeof blob.overview === "string" ? blob.overview.trim() : "";
    pathology = {
      ...pathology,
      latest_ai_interpretation: {
        id: String(x.id),
        pathology_result_id: String(x.pathology_result_id),
        status: String(x.status ?? ""),
        hair_loss_relevance_score:
          x.hair_loss_relevance_score != null && Number.isFinite(Number(x.hair_loss_relevance_score))
            ? Number(x.hair_loss_relevance_score)
            : null,
        surgical_readiness_score:
          x.surgical_readiness_score != null && Number.isFinite(Number(x.surgical_readiness_score))
            ? Number(x.surgical_readiness_score)
            : null,
        main_contributors,
        overview_snippet: overviewRaw ? overviewRaw.slice(0, 240) : null,
        created_at: String(x.created_at ?? ""),
        reviewed_at: x.reviewed_at != null ? String(x.reviewed_at) : null,
      },
    };
  }

  let structured_profile: PatientTwinV1["clinical"]["structured_profile"] = null;
  const { data: clin, error: cne } = await supabase
    .from("fi_patient_clinical_details")
    .select("norwood_scale, ludwig_scale, hairline_pattern, primary_concern, treatment_interest")
    .eq("tenant_id", tid)
    .eq("patient_id", primaryFoundation)
    .maybeSingle();
  if (cne) {
    pushWarning(warnings, "generic", `Clinical structured profile skipped: ${cne.message}`);
  } else if (clin) {
    const c = clin as Record<string, unknown>;
    structured_profile = {
      norwood_scale: c.norwood_scale != null ? String(c.norwood_scale) : null,
      ludwig_scale: c.ludwig_scale != null ? String(c.ludwig_scale) : null,
      hairline_pattern: c.hairline_pattern != null ? String(c.hairline_pattern) : null,
      primary_concern: c.primary_concern != null ? String(c.primary_concern) : null,
      treatment_interest: c.treatment_interest != null ? String(c.treatment_interest) : null,
    };
  }

  let medications = emptyPatientTwinMedicationsSection();
  try {
    const [therapySummary, therapyEvents] = await Promise.all([
      loadActiveTherapyPlanSummary(supabase, tid, primaryFoundation),
      loadPatientTherapyEventsForPatient(supabase, tid, primaryFoundation, {
        limit: PATIENT_TWIN_MEDICATION_OS_EVENTS_READ_CAP,
      }),
    ]);
    medications = buildPatientTwinMedicationsSection(therapySummary, therapyEvents);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushWarning(warnings, "generic", `MedicationOS Patient Twin section skipped: ${msg}`);
  }

  const generatedAt = new Date().toISOString();
  const twinBefore: PatientTwinV1ForCompleteness = {
    version: PATIENT_TWIN_VERSION,
    tenant_id: tid,
    patient_id: primaryFoundation,
    person: {
      person_id: base.person?.person_id ?? base.anchor.person_id,
      display_name,
      email,
      phone,
      date_of_birth,
      address: idc.address,
      preferred_contact_method: idc.preferredContactMethod,
      reminder_consent: idc.reminderConsent,
      lifecycle_stage: idc.lifecycleStage,
      lead_status: idc.leadStatus,
      stage_of_journey: idc.stageOfJourney,
      import_batch_id: idc.importBatchId,
      hubspot_record_id: idc.hubspotRecordId,
      source_labels,
    },
    identity_resolution,
    crm,
    cases: casesOut,
    audits,
    media,
    imaging,
    photo_protocol,
    pathology,
    timeline: {
      order: "newest_first",
      items: timelineItems,
      item_cap: TIMELINE_CAP,
    },
    clinical: {
      structured_profile,
      medications,
      treatments: [],
      blood_markers: [],
    },
    intelligence: {
      risk_score: null,
      predicted_outcome: null,
      model_outputs: [],
      hair_loss,
      hair_progression,
      donor,
    },
    provenance: {
      generated_at: generatedAt,
      loader_version: PATIENT_TWIN_LOADER_VERSION,
      source_views_used: [...SOURCE_VIEWS_USED],
      source_tables_used: [...SOURCE_TABLES_USED],
      completeness_score: 0,
    },
    warnings: dedupeWarnings(warnings),
  };

  const completeness = calculatePatientTwinCompleteness(twinBefore);

  const twin: PatientTwinV1 = {
    ...twinBefore,
    completeness,
    provenance: {
      ...twinBefore.provenance,
      completeness_score: completeness.score,
    },
  };

  const parsed = patientTwinV1Schema.safeParse(twin);
  if (!parsed.success) {
    throw new Error(`PatientTwin V1 schema validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

function dedupeWarnings(w: PatientTwinWarning[]): PatientTwinWarning[] {
  const seen = new Set<string>();
  const out: PatientTwinWarning[] = [];
  for (const row of w) {
    const k = `${row.code}:${row.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}
