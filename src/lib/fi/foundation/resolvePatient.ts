import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "./internal";
import type {
  FiPatientRow,
  FoundationSupabase,
  ResolvePatientInput,
  ResolvePatientResult,
} from "./types";

function asPatientRow(row: Record<string, unknown>): FiPatientRow {
  const out: FiPatientRow = {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    person_id: String(row.person_id),
    primary_clinic_id: row.primary_clinic_id == null ? null : String(row.primary_clinic_id),
    metadata: (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
  if ("admin_note" in row) out.admin_note = row.admin_note != null ? String(row.admin_note) : null;
  if ("patient_status" in row && row.patient_status != null) out.patient_status = String(row.patient_status);
  return out;
}

async function ensurePatientSourceMapping(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  sourceSystem: string,
  sourcePatientId: string | null
): Promise<boolean> {
  if (!sourcePatientId) return false;
  const { error } = await supabase.from("fi_patient_source_ids").insert({
    tenant_id: tenantId,
    patient_id: patientId,
    source_system: sourceSystem,
    source_patient_id: sourcePatientId,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Idempotent: fi_patient_source_ids → global_patient_id triple → existing person patient → create.
 * Never mutates fi_global_patients.
 */
export async function resolveOrCreatePatient(
  input: ResolvePatientInput,
  client?: FoundationSupabase
): Promise<ResolvePatientResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const personId = input.person_id.trim();
  const sourceSystem = input.source_system.trim();
  const sourcePatientId = input.source_patient_id?.trim() || null;
  const globalPatientId = input.global_patient_id?.trim() || null;

  let mappingSourceSystem = sourceSystem;
  let mappingSourcePatientId = sourcePatientId;

  if (sourcePatientId) {
    const mapped = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_patient_id", sourcePatientId)
      .maybeSingle();
    if (mapped.error) throw new Error(mapped.error.message);
    if (mapped.data?.patient_id) {
      const row = await supabase
        .from("fi_patients")
        .select("id, tenant_id, person_id, primary_clinic_id, metadata, admin_note, patient_status, created_at, updated_at")
        .eq("id", mapped.data.patient_id)
        .single();
      if (row.error || !row.data) throw new Error(row.error?.message ?? "Patient not found for mapping.");
      return { patient: asPatientRow(row.data as Record<string, unknown>), created: false, mapping_created: false };
    }
  }

  if (globalPatientId) {
    const gp = await supabase
      .from("fi_global_patients")
      .select("source_system, source_patient_id")
      .eq("id", globalPatientId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (gp.error) throw new Error(gp.error.message);
    if (gp.data?.source_patient_id) {
      mappingSourceSystem = String(gp.data.source_system);
      mappingSourcePatientId = String(gp.data.source_patient_id);
      const mapped = await supabase
        .from("fi_patient_source_ids")
        .select("patient_id")
        .eq("tenant_id", tenantId)
        .eq("source_system", mappingSourceSystem)
        .eq("source_patient_id", mappingSourcePatientId)
        .maybeSingle();
      if (mapped.error) throw new Error(mapped.error.message);
      if (mapped.data?.patient_id) {
        const row = await supabase
          .from("fi_patients")
          .select("id, tenant_id, person_id, primary_clinic_id, metadata, admin_note, patient_status, created_at, updated_at")
          .eq("id", mapped.data.patient_id)
          .single();
        if (row.data) {
          return { patient: asPatientRow(row.data as Record<string, unknown>), created: false, mapping_created: false };
        }
      }
    }
  }

  const existingByPerson = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id, primary_clinic_id, metadata, admin_note, patient_status, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .maybeSingle();
  if (existingByPerson.error) throw new Error(existingByPerson.error.message);
  if (existingByPerson.data) {
    const patient = asPatientRow(existingByPerson.data as Record<string, unknown>);
    const mappingCreated = await ensurePatientSourceMapping(
      supabase,
      tenantId,
      patient.id,
      mappingSourceSystem,
      mappingSourcePatientId
    );
    return { patient, created: false, mapping_created: mappingCreated };
  }

  const metadata = shallowMergeMetadata(
    {
      ...(input.metadata ?? {}),
      resolution_source: "foundation_resolveOrCreatePatient",
      ...(globalPatientId ? { linked_global_patient_id: globalPatientId } : {}),
    },
    null
  );

  const insertRow = {
    tenant_id: tenantId,
    person_id: personId,
    primary_clinic_id: input.primary_clinic_id?.trim() || null,
    metadata,
  };

  const inserted = await supabase
    .from("fi_patients")
    .insert(insertRow)
    .select("id, tenant_id, person_id, primary_clinic_id, metadata, admin_note, patient_status, created_at, updated_at")
    .single();

  if (inserted.error?.code === "23505") {
    const retry = await supabase
      .from("fi_patients")
      .select("id, tenant_id, person_id, primary_clinic_id, metadata, admin_note, patient_status, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .eq("person_id", personId)
      .single();
    if (retry.data) {
      const patient = asPatientRow(retry.data as Record<string, unknown>);
      const mappingCreated = await ensurePatientSourceMapping(
        supabase,
        tenantId,
        patient.id,
        mappingSourceSystem,
        mappingSourcePatientId
      );
      return { patient, created: false, mapping_created: mappingCreated };
    }
  }

  if (inserted.error) throw new Error(inserted.error.message);
  const patient = asPatientRow(inserted.data as Record<string, unknown>);
  const mappingCreated = await ensurePatientSourceMapping(
    supabase,
    tenantId,
    patient.id,
    mappingSourceSystem,
    mappingSourcePatientId
  );
  return { patient, created: true, mapping_created: mappingCreated };
}
