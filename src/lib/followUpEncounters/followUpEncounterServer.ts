import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { shallowMergeMetadata } from "@/src/lib/fi/foundation/internal";
import { PROGRESS_META_KEY } from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  buildLegacyPatientDuplicateIndex,
  buildLegacyPatientMetadata,
  checkLegacyPatientDuplicates,
  resolveBlockingPatientMatch,
  type LegacyPatientCandidate,
} from "./legacyPatientCore";
import type {
  FollowUpEncounterRow,
  FollowUpEncounterType,
  ImagingSessionAiReviewStatus,
  LegacyPatientSource,
} from "./followUpEncounterTypes";
import type { z } from "zod";
import type {
  createFollowUpEncounterBodySchema,
  createLegacyReturningPatientBodySchema,
} from "./followUpEncounterTypes";

type CreateLegacyPatientInput = z.infer<typeof createLegacyReturningPatientBodySchema>;
type CreateFollowUpInput = z.infer<typeof createFollowUpEncounterBodySchema>;

function asFollowUpRow(raw: Record<string, unknown>): FollowUpEncounterRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    staff_id: raw.staff_id != null ? String(raw.staff_id) : null,
    booking_id: raw.booking_id != null ? String(raw.booking_id) : null,
    encounter_type: String(raw.encounter_type) as FollowUpEncounterType,
    legacy_source: raw.legacy_source != null ? (String(raw.legacy_source) as LegacyPatientSource) : null,
    legacy_external_id: raw.legacy_external_id != null ? String(raw.legacy_external_id) : null,
    visit_reason: raw.visit_reason != null ? String(raw.visit_reason) : null,
    clinical_note: raw.clinical_note != null ? String(raw.clinical_note) : null,
    treatment_update: raw.treatment_update != null ? String(raw.treatment_update) : null,
    follow_up_plan: raw.follow_up_plan != null ? String(raw.follow_up_plan) : null,
    status: raw.status === "completed" ? "completed" : "draft",
    created_by: raw.created_by != null ? String(raw.created_by) : null,
    completed_at: raw.completed_at != null ? String(raw.completed_at) : null,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function loadLegacyPatientCandidates(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LegacyPatientCandidate[]> {
  const { data: patients, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId)
    .neq("patient_status", "duplicate")
    .limit(5000);
  if (error) throw new Error(error.message);
  if (!patients?.length) return [];

  const personIds = Array.from(new Set(patients.map((p) => String((p as { person_id: string }).person_id))));
  const { data: persons, error: pe } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", personIds);
  if (pe) throw new Error(pe.message);

  const personById = new Map(
    (persons ?? []).map((p) => [String((p as { id: string }).id), p as { id: string; metadata: unknown }])
  );

  return patients.map((raw) => {
    const p = raw as { id: string; person_id: string; metadata: unknown };
    const person = personById.get(String(p.person_id));
    const pMeta =
      p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
        ? (p.metadata as Record<string, unknown>)
        : {};
    const personMeta =
      person?.metadata && typeof person.metadata === "object" && !Array.isArray(person.metadata)
        ? (person.metadata as Record<string, unknown>)
        : {};

    const firstName = String(personMeta.first_name ?? pMeta.first_name ?? "");
    const lastName = String(personMeta.last_name ?? personMeta.surname ?? pMeta.surname ?? "");
    const displayName = `${firstName} ${lastName}`.trim() || "Unknown";

    return {
      patientId: String(p.id),
      personId: String(p.person_id),
      displayName,
      email: (personMeta.email ?? personMeta.primary_email ?? pMeta.email) as string | null,
      phone: (personMeta.phone ?? personMeta.mobile ?? pMeta.mobile) as string | null,
      dateOfBirth: (personMeta.date_of_birth ?? pMeta.date_of_birth) as string | null,
      legacySource: (pMeta.legacy_source as string | null) ?? null,
    };
  });
}

export type CreateLegacyReturningPatientResult =
  | {
      ok: true;
      patientId: string;
      personId: string;
      created: boolean;
      duplicatePrevented: boolean;
      duplicateSummary: string | null;
    }
  | { ok: false; error: string };

export async function createLegacyReturningPatient(
  tenantId: string,
  input: CreateLegacyPatientInput,
  createdByUserId?: string | null
): Promise<CreateLegacyReturningPatientResult> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  const sourcePatientId = input.legacyExternalId?.trim();
  if (sourcePatientId) {
    const mapped = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id")
      .eq("tenant_id", tid)
      .eq("source_system", input.legacySource)
      .eq("source_patient_id", sourcePatientId)
      .maybeSingle();
    if (mapped.error) throw new Error(mapped.error.message);
    if (mapped.data?.patient_id) {
      const pat = await supabase
        .from("fi_patients")
        .select("id, person_id")
        .eq("tenant_id", tid)
        .eq("id", mapped.data.patient_id)
        .single();
      if (pat.data) {
        return {
          ok: true,
          patientId: String(pat.data.id),
          personId: String((pat.data as { person_id: string }).person_id),
          created: false,
          duplicatePrevented: true,
          duplicateSummary: "Matched existing Timely source ID mapping.",
        };
      }
    }
  }

  const candidates = await loadLegacyPatientCandidates(supabase, tid);
  const index = buildLegacyPatientDuplicateIndex(candidates);
  const dupResult = checkLegacyPatientDuplicates(
    {
      email: input.email,
      phone: input.mobile,
      displayName,
      dateOfBirth: input.dateOfBirth,
      legacyExternalId: input.legacyExternalId,
    },
    index
  );

  const existing = resolveBlockingPatientMatch(dupResult, candidates);
  if (existing) {
    return {
      ok: true,
      patientId: existing.patientId,
      personId: existing.personId,
      created: false,
      duplicatePrevented: true,
      duplicateSummary: dupResult.summary,
    };
  }

  const legacyMeta = buildLegacyPatientMetadata({
    legacySource: input.legacySource,
    legacyExternalId: input.legacyExternalId,
    legacyPatientReference: input.legacyPatientReference,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  const sourcePatientIdForCreate = sourcePatientId || undefined;

  const { person, created: personCreated } = await resolveOrCreatePerson(
    {
      tenant_id: tid,
      source_system: input.legacySource,
      source_patient_id: sourcePatientIdForCreate,
      display_name: displayName,
      phone: input.mobile.trim(),
      email: input.email.trim(),
      date_of_birth: input.dateOfBirth?.trim(),
      metadata: legacyMeta,
    },
    supabase
  );

  const patientMeta = shallowMergeMetadata(
    {
      legacy_source: input.legacySource,
      returning_patient: true,
      historical_record_note: "Historical record not fully imported yet",
    },
    null
  );

  const { patient, created: patientCreated } = await resolveOrCreatePatient(
    {
      tenant_id: tid,
      person_id: person.id,
      source_system: input.legacySource,
      source_patient_id: sourcePatientIdForCreate,
      metadata: patientMeta,
    },
    supabase
  );

  if (sourcePatientIdForCreate && (personCreated || patientCreated)) {
    await supabase.from("fi_patient_source_ids").upsert(
      {
        tenant_id: tid,
        patient_id: patient.id,
        source_system: input.legacySource,
        source_patient_id: sourcePatientIdForCreate,
      },
      { onConflict: "tenant_id,source_system,source_patient_id", ignoreDuplicates: true }
    );
  }

  void createdByUserId;

  return {
    ok: true,
    patientId: patient.id,
    personId: person.id,
    created: personCreated || patientCreated,
    duplicatePrevented: false,
    duplicateSummary: null,
  };
}

export async function createFollowUpEncounter(
  tenantId: string,
  input: CreateFollowUpInput,
  createdByUserId?: string | null
): Promise<{ encounter: FollowUpEncounterRow }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const pid = input.patientId.trim();

  const { data: pat, error: pe } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!pat) throw new Error("Patient not found.");

  const now = new Date().toISOString();
  const isCompleted = input.status === "completed";

  const { data: ins, error } = await supabase
    .from("fi_follow_up_encounters")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      clinic_id: input.clinicId ?? null,
      staff_id: input.staffId ?? null,
      booking_id: input.bookingId ?? null,
      encounter_type: input.encounterType,
      legacy_source: input.legacySource ?? null,
      legacy_external_id: input.legacyExternalId ?? null,
      visit_reason: input.visitReason?.trim() || null,
      clinical_note: input.clinicalNote?.trim() || null,
      treatment_update: input.treatmentUpdate?.trim() || null,
      follow_up_plan: input.followUpPlan?.trim() || null,
      status: input.status,
      created_by: createdByUserId ?? null,
      completed_at: isCompleted ? now : null,
      metadata: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { encounter: asFollowUpRow(ins as Record<string, unknown>) };
}

export async function createFollowUpImagingSession(
  tenantId: string,
  patientId: string,
  followUpEncounterId: string,
  opts?: { templateSlug?: string }
): Promise<{ sessionId: string }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const eid = followUpEncounterId.trim();
  const templateSlug = opts?.templateSlug?.trim() || "follow_up_review";

  const { data: enc, error: ee } = await supabase
    .from("fi_follow_up_encounters")
    .select("id, patient_id")
    .eq("tenant_id", tid)
    .eq("id", eid)
    .eq("patient_id", pid)
    .maybeSingle();
  if (ee) throw new Error(ee.message);
  if (!enc) throw new Error("Follow-up encounter not found.");

  const progressMeta = {
    capture_source: "legacy_follow_up",
    follow_up_encounter_id: eid,
  };

  const { data: ins, error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      follow_up_encounter_id: eid,
      template_slug: templateSlug,
      progress: { [PROGRESS_META_KEY]: progressMeta },
      session_completeness_status: "incomplete",
      ai_status: "pending",
      ai_review_status: "ai_pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { sessionId: String((ins as { id: string }).id) };
}

export async function loadFollowUpEncountersForBooking(
  tenantId: string,
  bookingId: string
): Promise<FollowUpEncounterRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_follow_up_encounters")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("booking_id", bookingId.trim())
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asFollowUpRow(r as Record<string, unknown>));
}

export async function loadFollowUpEncountersForPatient(
  tenantId: string,
  patientId: string
): Promise<FollowUpEncounterRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_follow_up_encounters")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => asFollowUpRow(r as Record<string, unknown>));
}

export async function updateImagingSessionAiReview(
  tenantId: string,
  sessionId: string,
  reviewStatus: Extract<ImagingSessionAiReviewStatus, "clinician_approved" | "clinician_rejected">,
  staffId: string,
  clinicianNote?: string | null
): Promise<void> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: le } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select("ai_review_audit")
    .eq("tenant_id", tenantId.trim())
    .eq("id", sessionId.trim())
    .maybeSingle();
  if (le) throw new Error(le.message);
  if (!existing) throw new Error("Imaging session not found.");

  const priorAudit = Array.isArray((existing as { ai_review_audit?: unknown }).ai_review_audit)
    ? ((existing as { ai_review_audit: unknown[] }).ai_review_audit as unknown[])
    : [];

  const auditEntry = {
    at: now,
    staff_id: staffId,
    review_status: reviewStatus,
    note: clinicianNote?.trim() || null,
  };

  const { error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .update({
      ai_review_status: reviewStatus,
      ai_reviewed_by_staff_id: staffId,
      ai_reviewed_at: now,
      ai_review_audit: [...priorAudit, auditEntry],
    })
    .eq("tenant_id", tenantId.trim())
    .eq("id", sessionId.trim());

  if (error) throw new Error(error.message);
}

export async function loadFollowUpImagingSessionsForPatient(
  tenantId: string,
  patientId: string
): Promise<
  {
    id: string;
    follow_up_encounter_id: string | null;
    template_slug: string;
    ai_status: string | null;
    ai_review_status: string | null;
    session_completeness_status: string | null;
    created_at: string;
  }[]
> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_imaging_protocol_sessions")
    .select(
      "id, follow_up_encounter_id, template_slug, ai_status, ai_review_status, session_completeness_status, created_at"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .not("follow_up_encounter_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      follow_up_encounter_id:
        x.follow_up_encounter_id != null ? String(x.follow_up_encounter_id) : null,
      template_slug: String(x.template_slug),
      ai_status: x.ai_status != null ? String(x.ai_status) : null,
      ai_review_status: x.ai_review_status != null ? String(x.ai_review_status) : null,
      session_completeness_status:
        x.session_completeness_status != null ? String(x.session_completeness_status) : null,
      created_at: String(x.created_at),
    };
  });
}

/** Search patients by name/email/phone for returning patient flow. */
export async function searchReturningPatients(
  tenantId: string,
  query: string
): Promise<LegacyPatientCandidate[]> {
  const supabase = supabaseAdmin();
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const candidates = await loadLegacyPatientCandidates(supabase, tenantId.trim());
  const emailNorm = normalizeEmail(query);

  return candidates
    .filter((c) => {
      const name = c.displayName.toLowerCase();
      const email = normalizeEmail(c.email);
      const phone = c.phone?.replace(/\D/g, "") ?? "";
      const qDigits = q.replace(/\D/g, "");
      return (
        name.includes(q) ||
        (emailNorm && email === emailNorm) ||
        (qDigits.length >= 4 && phone.includes(qDigits))
      );
    })
    .slice(0, 20);
}
