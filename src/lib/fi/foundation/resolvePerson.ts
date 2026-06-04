import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "./internal";
import { isPlaceholderEmail, normalizeEmail, normalizeWhitespaceName } from "./normalize";
import type {
  FiPersonRow,
  FoundationSupabase,
  ResolvePersonInput,
  ResolvePersonResult,
} from "./types";

function asPersonRow(row: Record<string, unknown>): FiPersonRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    metadata: (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function ensurePersonSourceMapping(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string,
  sourceSystem: string,
  sourcePersonId: string | null
): Promise<boolean> {
  if (!sourcePersonId) return false;
  const { error } = await supabase.from("fi_person_source_ids").insert({
    tenant_id: tenantId,
    person_id: personId,
    source_system: sourceSystem,
    source_person_id: sourcePersonId,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Idempotent: source_person_id → source_patient_id (via patient→person) → single email match → create.
 * Does not merge on display name alone.
 */
export async function resolveOrCreatePerson(
  input: ResolvePersonInput,
  client?: FoundationSupabase
): Promise<ResolvePersonResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const sourceSystem = input.source_system.trim();
  const sourcePersonId = input.source_person_id?.trim() || null;
  const sourcePatientId = input.source_patient_id?.trim() || null;

  if (sourcePersonId) {
    const mapped = await supabase
      .from("fi_person_source_ids")
      .select("person_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_person_id", sourcePersonId)
      .maybeSingle();
    if (mapped.error) throw new Error(mapped.error.message);
    if (mapped.data?.person_id) {
      const row = await supabase
        .from("fi_persons")
        .select("id, tenant_id, metadata, created_at, updated_at")
        .eq("id", mapped.data.person_id)
        .single();
      if (row.error || !row.data) throw new Error(row.error?.message ?? "Person not found for mapping.");
      return { person: asPersonRow(row.data as Record<string, unknown>), created: false, mapping_created: false };
    }
  }

  if (sourcePatientId) {
    const psi = await supabase
      .from("fi_patient_source_ids")
      .select("patient_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_patient_id", sourcePatientId)
      .maybeSingle();
    if (psi.error) throw new Error(psi.error.message);
    if (psi.data?.patient_id) {
      const pat = await supabase
        .from("fi_patients")
        .select("person_id")
        .eq("id", psi.data.patient_id)
        .single();
      if (pat.data?.person_id) {
        const row = await supabase
          .from("fi_persons")
          .select("id, tenant_id, metadata, created_at, updated_at")
          .eq("id", pat.data.person_id)
          .single();
        if (row.data) {
          const mappingCreated = await ensurePersonSourceMapping(
            supabase,
            tenantId,
            String(pat.data.person_id),
            sourceSystem,
            sourcePersonId
          );
          return { person: asPersonRow(row.data as Record<string, unknown>), created: false, mapping_created: mappingCreated };
        }
      }
    }
  }

  const emailNorm = normalizeEmail(input.email);
  if (emailNorm && !isPlaceholderEmail(emailNorm)) {
    const { data: persons, error: pe } = await supabase
      .from("fi_persons")
      .select("id, tenant_id, metadata, created_at, updated_at")
      .eq("tenant_id", tenantId);
    if (pe) throw new Error(pe.message);
    const rows = (persons ?? []) as Record<string, unknown>[];
    const emailMatches = rows.filter((r) => {
      const m = r.metadata as Record<string, unknown> | undefined;
      if (!m || typeof m !== "object") return false;
      return typeof m.email_normalized === "string" && m.email_normalized === emailNorm;
    });
    if (emailMatches.length === 1) {
      const person = asPersonRow(emailMatches[0]);
      const mappingCreated = await ensurePersonSourceMapping(supabase, tenantId, person.id, sourceSystem, sourcePersonId);
      return { person, created: false, mapping_created: mappingCreated };
    }
  }

  const normDisplay = normalizeWhitespaceName(input.display_name);
  const identityMeta: Record<string, unknown> = {};
  if (emailNorm && !isPlaceholderEmail(emailNorm)) {
    identityMeta.email_normalized = emailNorm;
  }
  if (normDisplay) {
    identityMeta.normalised_display_name = normDisplay;
  }
  const metadata = shallowMergeMetadata(
    {
      ...(input.metadata ?? {}),
      resolution_source: "foundation_resolveOrCreatePerson",
      ...(input.display_name?.trim() ? { display_name: input.display_name.trim() } : {}),
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      ...(input.date_of_birth?.trim() ? { date_of_birth: input.date_of_birth.trim() } : {}),
      ...(input.sex?.trim() ? { sex: input.sex.trim() } : {}),
    },
    Object.keys(identityMeta).length ? identityMeta : null
  );

  const inserted = await supabase
    .from("fi_persons")
    .insert({
      tenant_id: tenantId,
      metadata,
    })
    .select("id, tenant_id, metadata, created_at, updated_at")
    .single();

  if (inserted.error?.code === "23505" && sourcePersonId) {
    const retry = await supabase
      .from("fi_person_source_ids")
      .select("person_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_person_id", sourcePersonId)
      .maybeSingle();
    if (retry.data?.person_id) {
      const row = await supabase
        .from("fi_persons")
        .select("id, tenant_id, metadata, created_at, updated_at")
        .eq("id", retry.data.person_id)
        .single();
      if (row.data) return { person: asPersonRow(row.data as Record<string, unknown>), created: false, mapping_created: false };
    }
  }

  if (inserted.error) throw new Error(inserted.error.message);
  const person = asPersonRow(inserted.data as Record<string, unknown>);
  const mappingCreated = await ensurePersonSourceMapping(supabase, tenantId, person.id, sourceSystem, sourcePersonId);
  return { person, created: true, mapping_created: mappingCreated };
}
