import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deriveLegacyPatientVisibilitySummary,
  matchesLegacyPatientDirectoryFilters,
  type LegacyFollowUpEncounterSnapshot,
  type LegacyFollowUpImagingSessionSnapshot,
  type LegacyPatientSourceMapping,
  type LegacyPatientVisibilitySummary,
} from "./legacyPatientVisibilityCore";
import {
  patientDirectoryLegacyFiltersFromQuery,
  type PatientDirectoryLegacyQueryFields,
} from "./patientDirectoryFilters";

type PatientMetaRow = {
  id: string;
  metadata: unknown;
};

function metaRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function loadSourceMappingsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, LegacyPatientSourceMapping[]>> {
  const out = new Map<string, LegacyPatientSourceMapping[]>();
  if (!patientIds.length) return out;
  const { data, error } = await supabase
    .from("fi_patient_source_ids")
    .select("patient_id, source_system, source_patient_id")
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const pid = String((row as { patient_id: string }).patient_id);
    const list = out.get(pid) ?? [];
    list.push({
      source_system: String((row as { source_system: string }).source_system),
      source_patient_id: String((row as { source_patient_id: string }).source_patient_id),
    });
    out.set(pid, list);
  }
  return out;
}

async function loadEncountersByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, LegacyFollowUpEncounterSnapshot[]>> {
  const out = new Map<string, LegacyFollowUpEncounterSnapshot[]>();
  if (!patientIds.length) return out;
  const { data, error } = await supabase
    .from("fi_follow_up_encounters")
    .select(
      "id, patient_id, encounter_type, legacy_source, status, booking_id, created_at, completed_at"
    )
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const pid = String(r.patient_id);
    const list = out.get(pid) ?? [];
    list.push({
      id: String(r.id),
      encounter_type: String(r.encounter_type),
      legacy_source: r.legacy_source != null ? String(r.legacy_source) : null,
      status: String(r.status),
      booking_id: r.booking_id != null ? String(r.booking_id) : null,
      created_at: String(r.created_at),
      completed_at: r.completed_at != null ? String(r.completed_at) : null,
    });
    out.set(pid, list);
  }
  return out;
}

async function loadImagingSessionsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, LegacyFollowUpImagingSessionSnapshot[]>> {
  const out = new Map<string, LegacyFollowUpImagingSessionSnapshot[]>();
  if (!patientIds.length) return out;
  const { data, error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select(
      "id, patient_id, follow_up_encounter_id, session_completeness_status, ai_status, ai_review_status, created_at"
    )
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds)
    .not("follow_up_encounter_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const pid = String(r.patient_id);
    const list = out.get(pid) ?? [];
    list.push({
      id: String(r.id),
      follow_up_encounter_id:
        r.follow_up_encounter_id != null ? String(r.follow_up_encounter_id) : null,
      session_completeness_status:
        r.session_completeness_status != null ? String(r.session_completeness_status) : null,
      ai_status: r.ai_status != null ? String(r.ai_status) : null,
      ai_review_status: r.ai_review_status != null ? String(r.ai_review_status) : null,
      created_at: String(r.created_at),
    });
    out.set(pid, list);
  }
  return out;
}

async function loadFollowUpImageCountsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!patientIds.length) return out;
  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("patient_id, metadata")
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const r = row as { patient_id: string; metadata: unknown };
    const meta = metaRecord(r.metadata);
    if (typeof meta.follow_up_encounter_id !== "string" || !meta.follow_up_encounter_id.trim()) {
      continue;
    }
    const pid = String(r.patient_id);
    out.set(pid, (out.get(pid) ?? 0) + 1);
  }
  return out;
}

async function loadLatestBookingIdByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!patientIds.length) return out;
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, patient_id, start_at")
    .eq("tenant_id", tenantId)
    .in("patient_id", patientIds)
    .order("start_at", { ascending: false });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const pid = String((row as { patient_id: string }).patient_id);
    if (!out.has(pid)) out.set(pid, String((row as { id: string }).id));
  }
  return out;
}

export async function buildLegacyVisibilitySummariesForPatients(
  tenantId: string,
  patients: readonly PatientMetaRow[],
  client?: SupabaseClient
): Promise<Map<string, LegacyPatientVisibilitySummary>> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const patientIds = patients.map((p) => String(p.id));
  const out = new Map<string, LegacyPatientVisibilitySummary>();
  if (!patientIds.length) return out;

  const [sourceByPatient, encountersByPatient, sessionsByPatient, imageCounts, latestBooking] =
    await Promise.all([
      loadSourceMappingsByPatient(supabase, tid, patientIds),
      loadEncountersByPatient(supabase, tid, patientIds),
      loadImagingSessionsByPatient(supabase, tid, patientIds),
      loadFollowUpImageCountsByPatient(supabase, tid, patientIds),
      loadLatestBookingIdByPatient(supabase, tid, patientIds),
    ]);

  for (const patient of patients) {
    const pid = String(patient.id);
    const summary = deriveLegacyPatientVisibilitySummary({
      patientId: pid,
      patientMetadata: metaRecord(patient.metadata),
      sourceMappings: sourceByPatient.get(pid) ?? [],
      encounters: encountersByPatient.get(pid) ?? [],
      imagingSessions: sessionsByPatient.get(pid) ?? [],
      followUpImageCount: imageCounts.get(pid) ?? 0,
      latestBookingId: latestBooking.get(pid) ?? null,
    });
    out.set(pid, summary);
  }

  return out;
}

async function loadAllTenantPatientMeta(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PatientMetaRow[]> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    metadata: (r as { metadata: unknown }).metadata,
  }));
}

export async function loadPatientIdsMatchingLegacyDirectoryFilters(
  tenantId: string,
  query: PatientDirectoryLegacyQueryFields,
  client?: SupabaseClient
): Promise<string[] | null> {
  const filters = patientDirectoryLegacyFiltersFromQuery(query);
  const hasAny =
    filters.returningFromTimely ||
    filters.hasLegacySource ||
    filters.historicalIncomplete ||
    filters.hasFollowUpEncounter ||
    filters.hasPhotosCaptured ||
    filters.aiReviewPending ||
    filters.clinicianApprovedAi ||
    filters.needsMergeReview ||
    filters.photosNoAiApproval ||
    filters.followUpSince;
  if (!hasAny) return null;

  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const allPatients = await loadAllTenantPatientMeta(supabase, tid);
  const summaries = await buildLegacyVisibilitySummariesForPatients(tid, allPatients, supabase);

  const encounterDatesByPatient = new Map<string, string[]>();
  const { data: encRows } = await supabase
    .from("fi_follow_up_encounters")
    .select("patient_id, created_at")
    .eq("tenant_id", tid);
  for (const row of encRows ?? []) {
    const pid = String((row as { patient_id: string }).patient_id);
    const list = encounterDatesByPatient.get(pid) ?? [];
    list.push(String((row as { created_at: string }).created_at));
    encounterDatesByPatient.set(pid, list);
  }

  const matched: string[] = [];
  for (const [pid, summary] of Array.from(summaries.entries())) {
    if (
      matchesLegacyPatientDirectoryFilters(summary, filters, {
        followUpEncounterDates: encounterDatesByPatient.get(pid) ?? [],
      })
    ) {
      matched.push(pid);
    }
  }
  return matched;
}