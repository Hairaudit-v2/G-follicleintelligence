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

/** PostgREST URL length blows up with huge `.in()` lists — keep chunks small. */
const IN_CHUNK_SIZE = 120;
/** Safety cap for directory filter candidates (saved views). */
const MAX_FILTER_CANDIDATES = 2500;

function metaRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function uniquePatientIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function chunkIds(ids: readonly string[], size = IN_CHUNK_SIZE): string[][] {
  const list = uniquePatientIds(ids);
  if (!list.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

/**
 * Run a patient-id scoped query in chunks and merge maps.
 * On per-chunk failure, skip that chunk (prefer partial/empty over 400 crash).
 */
async function mergeMapsInChunks<T>(
  patientIds: readonly string[],
  loadChunk: (chunk: string[]) => Promise<Map<string, T>>
): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  for (const chunk of chunkIds(patientIds)) {
    try {
      const part = await loadChunk(chunk);
      for (const [k, v] of part) out.set(k, v);
    } catch (e) {
      console.error("[legacyPatientVisibility] chunk query failed", e);
    }
  }
  return out;
}

async function loadSourceMappingsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, LegacyPatientSourceMapping[]>> {
  return mergeMapsInChunks(patientIds, async (chunk) => {
    const out = new Map<string, LegacyPatientSourceMapping[]>();
    const { data, error } = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id, source_system, source_patient_id")
      .eq("tenant_id", tenantId)
      .in("patient_id", chunk);
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
  });
}

async function loadEncountersByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, LegacyFollowUpEncounterSnapshot[]>> {
  return mergeMapsInChunks(patientIds, async (chunk) => {
    const out = new Map<string, LegacyFollowUpEncounterSnapshot[]>();
    const { data, error } = await supabase
      .from("fi_follow_up_encounters")
      .select(
        "id, patient_id, encounter_type, legacy_source, status, booking_id, created_at, completed_at"
      )
      .eq("tenant_id", tenantId)
      .in("patient_id", chunk)
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
  });
}

async function loadImagingSessionsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, LegacyFollowUpImagingSessionSnapshot[]>> {
  return mergeMapsInChunks(patientIds, async (chunk) => {
    const out = new Map<string, LegacyFollowUpImagingSessionSnapshot[]>();
    const { data, error } = await supabase
      .from("fi_imaging_protocol_sessions")
      .select(
        "id, patient_id, follow_up_encounter_id, session_completeness_status, ai_status, ai_review_status, created_at"
      )
      .eq("tenant_id", tenantId)
      .in("patient_id", chunk)
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
  });
}

async function loadFollowUpImageCountsByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  return mergeMapsInChunks(patientIds, async (chunk) => {
    const out = new Map<string, number>();
    const { data, error } = await supabase
      .from("fi_patient_images")
      .select("patient_id, metadata")
      .eq("tenant_id", tenantId)
      .in("patient_id", chunk)
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
  });
}

async function loadLatestBookingIdByPatient(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, string>> {
  return mergeMapsInChunks(patientIds, async (chunk) => {
    const out = new Map<string, string>();
    const { data, error } = await supabase
      .from("fi_bookings")
      .select("id, patient_id, start_at")
      .eq("tenant_id", tenantId)
      .in("patient_id", chunk)
      .order("start_at", { ascending: false });
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const pid = String((row as { patient_id: string }).patient_id);
      if (!out.has(pid)) out.set(pid, String((row as { id: string }).id));
    }
    return out;
  });
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

async function loadPatientMetaByIds(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: readonly string[]
): Promise<PatientMetaRow[]> {
  const out: PatientMetaRow[] = [];
  for (const chunk of chunkIds(patientIds)) {
    try {
      const { data, error } = await supabase
        .from("fi_patients")
        .select("id, metadata")
        .eq("tenant_id", tenantId)
        .in("id", chunk);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) {
        out.push({
          id: String((r as { id: string }).id),
          metadata: (r as { metadata: unknown }).metadata,
        });
      }
    } catch (e) {
      console.error("[legacyPatientVisibility] loadPatientMetaByIds chunk failed", e);
    }
  }
  return out;
}

/** Candidate IDs from fi_patient_source_ids (never loads all patients). */
async function candidateIdsFromSourceIds(
  supabase: SupabaseClient,
  tenantId: string,
  timelyOnly: boolean
): Promise<string[]> {
  let q = supabase
    .from("fi_patient_source_ids")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .limit(MAX_FILTER_CANDIDATES);
  if (timelyOnly) {
    q = q.ilike("source_system", "timely");
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return uniquePatientIds((data ?? []).map((r) => String((r as { patient_id: string }).patient_id)));
}

/** Candidate IDs from follow-up encounters. */
async function candidateIdsFromEncounters(
  supabase: SupabaseClient,
  tenantId: string,
  followUpSince: string | null | undefined
): Promise<string[]> {
  let q = supabase
    .from("fi_follow_up_encounters")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .limit(MAX_FILTER_CANDIDATES);
  if (followUpSince?.trim()) {
    q = q.gte("created_at", followUpSince.trim());
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return uniquePatientIds((data ?? []).map((r) => String((r as { patient_id: string }).patient_id)));
}

/** Candidate IDs from imaging sessions + follow-up images. */
async function candidateIdsFromImaging(
  supabase: SupabaseClient,
  tenantId: string,
  opts: {
    aiReviewPending?: boolean;
    clinicianApprovedAi?: boolean;
    hasPhotos?: boolean;
  }
): Promise<string[]> {
  const ids: string[] = [];

  let sessionQ = supabase
    .from("fi_imaging_protocol_sessions")
    .select("patient_id")
    .eq("tenant_id", tenantId)
    .not("follow_up_encounter_id", "is", null)
    .limit(MAX_FILTER_CANDIDATES);

  if (opts.aiReviewPending) {
    sessionQ = sessionQ.in("ai_review_status", ["ai_pending", "ai_ready_for_review"]);
  } else if (opts.clinicianApprovedAi) {
    sessionQ = sessionQ.in("ai_review_status", ["clinician_approved", "approved"]);
  } else if (opts.hasPhotos) {
    sessionQ = sessionQ.in("session_completeness_status", ["partial", "complete"]);
  }

  const { data: sessions, error: se } = await sessionQ;
  if (se) throw new Error(se.message);
  for (const row of sessions ?? []) {
    ids.push(String((row as { patient_id: string }).patient_id));
  }

  // Follow-up photos stored on fi_patient_images (metadata.follow_up_encounter_id).
  if (opts.hasPhotos || opts.aiReviewPending || opts.clinicianApprovedAi) {
    const { data: images, error: ie } = await supabase
      .from("fi_patient_images")
      .select("patient_id, metadata")
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .not("metadata->>follow_up_encounter_id", "is", null)
      .limit(MAX_FILTER_CANDIDATES);
    if (ie) throw new Error(ie.message);
    for (const row of images ?? []) {
      const meta = metaRecord((row as { metadata: unknown }).metadata);
      if (typeof meta.follow_up_encounter_id === "string" && meta.follow_up_encounter_id.trim()) {
        ids.push(String((row as { patient_id: string }).patient_id));
      }
    }
  }

  return uniquePatientIds(ids);
}

/**
 * Targeted patient metadata queries for flags that live on fi_patients only
 * (does not select the entire tenant roster).
 */
async function candidateIdsFromPatientMetadata(
  supabase: SupabaseClient,
  tenantId: string,
  filters: {
    returningFromTimely?: boolean;
    hasLegacySource?: boolean;
    historicalIncomplete?: boolean;
    needsMergeReview?: boolean;
  }
): Promise<string[]> {
  const ids: string[] = [];
  const queries: PromiseLike<{ data: unknown; error: { message: string } | null }>[] = [];

  if (filters.returningFromTimely) {
    queries.push(
      supabase
        .from("fi_patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("metadata->>legacy_source", "timely")
        .limit(MAX_FILTER_CANDIDATES)
    );
  }

  if (filters.hasLegacySource || filters.returningFromTimely || filters.historicalIncomplete) {
    queries.push(
      supabase
        .from("fi_patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("metadata->>returning_patient", "true")
        .limit(MAX_FILTER_CANDIDATES)
    );
    // Boolean true stored as JSON boolean (PostgREST text cast may differ).
    queries.push(
      supabase
        .from("fi_patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .filter("metadata->returning_patient", "eq", "true")
        .limit(MAX_FILTER_CANDIDATES)
    );
  }

  if (filters.hasLegacySource) {
    queries.push(
      supabase
        .from("fi_patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .not("metadata->>legacy_source", "is", null)
        .neq("metadata->>legacy_source", "")
        .limit(MAX_FILTER_CANDIDATES)
    );
  }

  if (filters.needsMergeReview) {
    queries.push(
      supabase
        .from("fi_patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .or(
          [
            "metadata->>needs_merge_review.eq.true",
            "metadata->>merge_review_needed.eq.true",
            "metadata->>merge_review_status.eq.needs_manual_merge_review",
          ].join(",")
        )
        .limit(MAX_FILTER_CANDIDATES)
    );
  }

  const results = await Promise.all(
    queries.map(async (p) => {
      try {
        return await p;
      } catch (e) {
        console.error("[legacyPatientVisibility] metadata candidate query failed", e);
        return { data: null, error: { message: "failed" } };
      }
    })
  );

  for (const res of results) {
    if (res.error) continue;
    for (const row of (res.data as { id: string }[] | null) ?? []) {
      ids.push(String(row.id));
    }
  }

  return uniquePatientIds(ids);
}

/**
 * Build a small candidate set for directory filters from related tables +
 * targeted metadata queries — never load every patient in the tenant first.
 */
async function collectLegacyDirectoryCandidatePatientIds(
  supabase: SupabaseClient,
  tenantId: string,
  filters: ReturnType<typeof patientDirectoryLegacyFiltersFromQuery>
): Promise<string[]> {
  const tasks: Promise<string[]>[] = [];

  const needsSource = Boolean(filters.returningFromTimely || filters.hasLegacySource);
  const needsEncounters = Boolean(filters.hasFollowUpEncounter || filters.followUpSince);
  const needsImaging = Boolean(
    filters.hasPhotosCaptured ||
      filters.aiReviewPending ||
      filters.clinicianApprovedAi ||
      filters.photosNoAiApproval
  );
  const needsMeta = Boolean(
    filters.returningFromTimely ||
      filters.hasLegacySource ||
      filters.historicalIncomplete ||
      filters.needsMergeReview
  );

  if (needsSource) {
    // Pure returning-Timely views can restrict to timely mappings; hasLegacySource needs all.
    const timelyOnly = Boolean(filters.returningFromTimely && !filters.hasLegacySource);
    tasks.push(candidateIdsFromSourceIds(supabase, tenantId, timelyOnly));
  }
  if (needsEncounters) {
    tasks.push(candidateIdsFromEncounters(supabase, tenantId, filters.followUpSince));
  }
  if (needsImaging) {
    tasks.push(
      candidateIdsFromImaging(supabase, tenantId, {
        aiReviewPending: Boolean(filters.aiReviewPending),
        clinicianApprovedAi: Boolean(filters.clinicianApprovedAi),
        hasPhotos: Boolean(
          filters.hasPhotosCaptured || filters.photosNoAiApproval || filters.aiReviewPending
        ),
      })
    );
  }
  if (needsMeta) {
    tasks.push(
      candidateIdsFromPatientMetadata(supabase, tenantId, {
        returningFromTimely: Boolean(filters.returningFromTimely),
        hasLegacySource: Boolean(filters.hasLegacySource),
        historicalIncomplete: Boolean(filters.historicalIncomplete),
        needsMergeReview: Boolean(filters.needsMergeReview),
      })
    );
  }

  if (!tasks.length) return [];

  const parts = await Promise.all(
    tasks.map(async (t) => {
      try {
        return await t;
      } catch (e) {
        console.error("[legacyPatientVisibility] candidate collection failed", e);
        return [] as string[];
      }
    })
  );

  return uniquePatientIds(parts.flat()).slice(0, MAX_FILTER_CANDIDATES);
}

/**
 * Patient IDs matching legacy directory / saved-view filters.
 * Returns null when no legacy filters are active; [] when none match or on soft failure.
 */
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

  try {
    const supabase = client ?? supabaseAdmin();
    const tid = tenantId.trim();

    const candidateIds = await collectLegacyDirectoryCandidatePatientIds(supabase, tid, filters);
    if (!candidateIds.length) return [];

    const patients = await loadPatientMetaByIds(supabase, tid, candidateIds);
    if (!patients.length) return [];

    const summaries = await buildLegacyVisibilitySummariesForPatients(tid, patients, supabase);

    const matched: string[] = [];
    for (const [pid, summary] of summaries) {
      // latest_follow_up_at is sufficient for followUpSince (any hit ≥ since implies latest ≥ since).
      const encounterDates = summary.latest_follow_up_at ? [summary.latest_follow_up_at] : [];
      if (
        matchesLegacyPatientDirectoryFilters(summary, filters, {
          followUpEncounterDates: encounterDates,
        })
      ) {
        matched.push(pid);
      }
    }
    return matched;
  } catch (e) {
    console.error("[legacyPatientVisibility] loadPatientIdsMatchingLegacyDirectoryFilters", e);
    return [];
  }
}
