import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { clinicalDetailsChangedKeys } from "./clinicalDetailsChangedFields";
import type { PatientClinicalDetailsPatchBody } from "./clinicalDetailsApiSchemas";
import { mergeClinicalDetailsPatch } from "./clinicalDetailsMerge";
import type { EditableClinicalDetailsPayload } from "./clinicalDetailsPolicy";
import {
  clinicalDetailsPatientRowMatchesTenant,
  normalizeEditableClinicalDetailsPayload,
} from "./clinicalDetailsPolicy";

export type PatientClinicalDetailsRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  person_id: string | null;
  primary_hair_concern: string | null;
  treatment_interest: string | null;
  hair_loss_duration: string | null;
  family_history: string | null;
  relevant_medical_history: string | null;
  current_medications: string | null;
  allergies: string | null;
  contraindications: string | null;
  scalp_conditions: string | null;
  previous_hair_treatments: string | null;
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
  clinical_flags: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapFlags(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta))
    return meta as Record<string, unknown>;
  return {};
}

function rowToPayload(row: PatientClinicalDetailsRow): EditableClinicalDetailsPayload {
  return normalizeEditableClinicalDetailsPayload({
    primary_hair_concern: row.primary_hair_concern,
    treatment_interest: row.treatment_interest,
    hair_loss_duration: row.hair_loss_duration,
    family_history: row.family_history,
    relevant_medical_history: row.relevant_medical_history,
    current_medications: row.current_medications,
    allergies: row.allergies,
    contraindications: row.contraindications,
    scalp_conditions: row.scalp_conditions,
    previous_hair_treatments: row.previous_hair_treatments,
    norwood_scale: row.norwood_scale,
    ludwig_scale: row.ludwig_scale,
    hairline_pattern: row.hairline_pattern,
    primary_concern: row.primary_concern,
    clinical_flags: row.clinical_flags,
    metadata: row.metadata,
  });
}

function emptyPayload(): EditableClinicalDetailsPayload {
  return normalizeEditableClinicalDetailsPayload({});
}

function mapRow(data: Record<string, unknown>): PatientClinicalDetailsRow {
  return {
    id: String(data.id),
    tenant_id: String(data.tenant_id),
    patient_id: String(data.patient_id),
    person_id: data.person_id != null ? String(data.person_id) : null,
    primary_hair_concern:
      data.primary_hair_concern != null ? String(data.primary_hair_concern) : null,
    treatment_interest: data.treatment_interest != null ? String(data.treatment_interest) : null,
    hair_loss_duration: data.hair_loss_duration != null ? String(data.hair_loss_duration) : null,
    family_history: data.family_history != null ? String(data.family_history) : null,
    relevant_medical_history:
      data.relevant_medical_history != null ? String(data.relevant_medical_history) : null,
    current_medications: data.current_medications != null ? String(data.current_medications) : null,
    allergies: data.allergies != null ? String(data.allergies) : null,
    contraindications: data.contraindications != null ? String(data.contraindications) : null,
    scalp_conditions: data.scalp_conditions != null ? String(data.scalp_conditions) : null,
    previous_hair_treatments:
      data.previous_hair_treatments != null ? String(data.previous_hair_treatments) : null,
    norwood_scale: data.norwood_scale != null ? String(data.norwood_scale) : null,
    ludwig_scale: data.ludwig_scale != null ? String(data.ludwig_scale) : null,
    hairline_pattern: data.hairline_pattern != null ? String(data.hairline_pattern) : null,
    primary_concern: data.primary_concern != null ? String(data.primary_concern) : null,
    clinical_flags: mapFlags(data.clinical_flags),
    metadata: mapFlags(data.metadata),
    created_by_user_id: data.created_by_user_id != null ? String(data.created_by_user_id) : null,
    updated_by_user_id: data.updated_by_user_id != null ? String(data.updated_by_user_id) : null,
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

function payloadToInsertColumns(
  tenantId: string,
  patientId: string,
  personId: string,
  payload: EditableClinicalDetailsPayload,
  actingUserId: string | null
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    tenant_id: tenantId,
    patient_id: patientId,
    person_id: personId,
    primary_hair_concern: payload.primary_hair_concern,
    treatment_interest: payload.treatment_interest,
    hair_loss_duration: payload.hair_loss_duration,
    family_history: payload.family_history,
    relevant_medical_history: payload.relevant_medical_history,
    current_medications: payload.current_medications,
    allergies: payload.allergies,
    contraindications: payload.contraindications,
    scalp_conditions: payload.scalp_conditions,
    previous_hair_treatments: payload.previous_hair_treatments,
    norwood_scale: payload.norwood_scale,
    ludwig_scale: payload.ludwig_scale,
    hairline_pattern: payload.hairline_pattern,
    primary_concern: payload.primary_concern,
    clinical_flags: payload.clinical_flags,
    metadata: payload.metadata,
    created_by_user_id: actingUserId,
    updated_by_user_id: actingUserId,
    created_at: now,
    updated_at: now,
  };
}

function payloadToUpdateColumns(
  personId: string,
  payload: EditableClinicalDetailsPayload,
  actingUserId: string | null
): Record<string, unknown> {
  return {
    person_id: personId,
    primary_hair_concern: payload.primary_hair_concern,
    treatment_interest: payload.treatment_interest,
    hair_loss_duration: payload.hair_loss_duration,
    family_history: payload.family_history,
    relevant_medical_history: payload.relevant_medical_history,
    current_medications: payload.current_medications,
    allergies: payload.allergies,
    contraindications: payload.contraindications,
    scalp_conditions: payload.scalp_conditions,
    previous_hair_treatments: payload.previous_hair_treatments,
    norwood_scale: payload.norwood_scale,
    ludwig_scale: payload.ludwig_scale,
    hairline_pattern: payload.hairline_pattern,
    primary_concern: payload.primary_concern,
    clinical_flags: payload.clinical_flags,
    metadata: payload.metadata,
    updated_by_user_id: actingUserId,
    updated_at: new Date().toISOString(),
  };
}

async function assertPatientInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<{ person_id: string }> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (
    !data ||
    !clinicalDetailsPatientRowMatchesTenant(tenantId, patientId, data as Record<string, unknown>)
  ) {
    throw new Error("Patient not found for tenant.");
  }
  return { person_id: String((data as { person_id: string }).person_id) };
}

export async function loadPatientClinicalDetails(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientClinicalDetailsRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return null;

  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .maybeSingle();
  if (error) {
    if (error.message?.includes("does not exist") || error.message?.includes("schema cache"))
      return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function upsertPatientClinicalDetails(
  params: {
    tenantId: string;
    patientId: string;
    payload: EditableClinicalDetailsPayload;
    actingUserId: string | null;
  },
  client?: SupabaseClient
): Promise<{ row: PatientClinicalDetailsRow; changedKeys: string[]; created: boolean }> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  const { person_id } = await assertPatientInTenant(supabase, tid, pid);

  const existing = await loadPatientClinicalDetails(tid, pid, supabase);
  const before = existing ? rowToPayload(existing) : emptyPayload();
  const after = params.payload;

  const changedKeys = clinicalDetailsChangedKeys(before, after);

  if (!existing) {
    const insert = payloadToInsertColumns(tid, pid, person_id, after, params.actingUserId);
    const { data, error } = await supabase
      .from("fi_patient_clinical_details")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { row: mapRow(data as Record<string, unknown>), changedKeys, created: true };
  }

  const upd = payloadToUpdateColumns(person_id, after, params.actingUserId);
  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .update(upd)
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { row: mapRow(data as Record<string, unknown>), changedKeys, created: false };
}

export async function updatePatientClinicalDetails(
  params: {
    tenantId: string;
    patientId: string;
    patch: PatientClinicalDetailsPatchBody;
    request?: Request | null;
  },
  client?: SupabaseClient
): Promise<{ row: PatientClinicalDetailsRow; changedKeys: string[]; created: boolean }> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  await assertPatientInTenant(supabase, tid, pid);

  const actingUserId = await tryResolveFiUserIdForTenant(tid, params.request ?? null);

  const existing = await loadPatientClinicalDetails(tid, pid, supabase);
  const base = existing ? rowToPayload(existing) : emptyPayload();
  const merged = mergeClinicalDetailsPatch(base, params.patch);
  return upsertPatientClinicalDetails(
    { tenantId: tid, patientId: pid, payload: merged, actingUserId },
    supabase
  );
}
