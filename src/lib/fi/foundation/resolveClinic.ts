import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "./internal";
import { normalizeWhitespaceName } from "./normalize";
import type {
  FiClinicRow,
  FoundationSupabase,
  ResolveClinicInput,
  ResolveClinicResult,
} from "./types";

function asClinicRow(row: Record<string, unknown>): FiClinicRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    organisation_id: row.organisation_id == null ? null : String(row.organisation_id),
    display_name: String(row.display_name),
    metadata:
      (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function ensureClinicSourceMapping(
  supabase: SupabaseClient,
  tenantId: string,
  clinicId: string,
  sourceSystem: string,
  sourceClinicId: string | null
): Promise<boolean> {
  if (!sourceClinicId) return false;
  const { error } = await supabase.from("fi_clinic_source_ids").insert({
    tenant_id: tenantId,
    clinic_id: clinicId,
    source_system: sourceSystem,
    source_clinic_id: sourceClinicId,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Idempotent: fi_clinic_source_ids → single name match under tenant+organisation → create.
 */
export async function resolveOrCreateClinic(
  input: ResolveClinicInput,
  client?: FoundationSupabase
): Promise<ResolveClinicResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const sourceSystem = input.source_system.trim();
  const sourceClinicId = input.source_clinic_id?.trim() || null;
  const orgId = input.organisation_id?.trim() || null;
  const displayName = input.name?.trim() || "Unnamed clinic";

  if (sourceClinicId) {
    const mapped = await supabase
      .from("fi_clinic_source_ids")
      .select("clinic_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_clinic_id", sourceClinicId)
      .maybeSingle();
    if (mapped.error) throw new Error(mapped.error.message);
    if (mapped.data?.clinic_id) {
      const row = await supabase
        .from("fi_clinics")
        .select("id, tenant_id, organisation_id, display_name, metadata, created_at, updated_at")
        .eq("id", mapped.data.clinic_id)
        .eq("tenant_id", tenantId)
        .single();
      if (row.error || !row.data)
        throw new Error(row.error?.message ?? "Clinic not found for mapping.");
      return {
        clinic: asClinicRow(row.data as Record<string, unknown>),
        created: false,
        mapping_created: false,
      };
    }
  }

  const normName = normalizeWhitespaceName(displayName);
  if (normName) {
    let q = supabase
      .from("fi_clinics")
      .select("id, tenant_id, organisation_id, display_name, metadata, created_at, updated_at")
      .eq("tenant_id", tenantId);
    if (orgId) q = q.eq("organisation_id", orgId);
    else q = q.is("organisation_id", null);
    const { data: candidates, error: listErr } = await q;
    if (listErr) throw new Error(listErr.message);
    const rows = (candidates ?? []) as Record<string, unknown>[];
    const matches = rows.filter(
      (r) => normalizeWhitespaceName(String(r.display_name)) === normName
    );
    if (matches.length === 1) {
      const clinic = asClinicRow(matches[0]);
      const mappingCreated = await ensureClinicSourceMapping(
        supabase,
        tenantId,
        clinic.id,
        sourceSystem,
        sourceClinicId
      );
      return { clinic, created: false, mapping_created: mappingCreated };
    }
  }

  const metadata = shallowMergeMetadata(
    {
      ...(input.metadata ?? {}),
      resolution_source: "foundation_resolveOrCreateClinic",
      ...(input.city ? { city: input.city } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
    normName ? { normalised_display_name: normName } : null
  );

  const insertRow = {
    tenant_id: tenantId,
    organisation_id: orgId,
    display_name: displayName,
    metadata,
  };

  const inserted = await supabase
    .from("fi_clinics")
    .insert(insertRow)
    .select("id, tenant_id, organisation_id, display_name, metadata, created_at, updated_at")
    .single();

  if (inserted.error?.code === "23505" && sourceClinicId) {
    const retry = await supabase
      .from("fi_clinic_source_ids")
      .select("clinic_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_clinic_id", sourceClinicId)
      .maybeSingle();
    if (retry.data?.clinic_id) {
      const row = await supabase
        .from("fi_clinics")
        .select("id, tenant_id, organisation_id, display_name, metadata, created_at, updated_at")
        .eq("id", retry.data.clinic_id)
        .eq("tenant_id", tenantId)
        .single();
      if (row.data)
        return {
          clinic: asClinicRow(row.data as Record<string, unknown>),
          created: false,
          mapping_created: false,
        };
    }
  }

  if (inserted.error) throw new Error(inserted.error.message);
  const clinic = asClinicRow(inserted.data as Record<string, unknown>);
  const mappingCreated = await ensureClinicSourceMapping(
    supabase,
    tenantId,
    clinic.id,
    sourceSystem,
    sourceClinicId
  );
  return { clinic, created: true, mapping_created: mappingCreated };
}
