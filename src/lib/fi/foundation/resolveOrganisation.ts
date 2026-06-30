import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata, slugifyOptional } from "./internal";
import { normalizeWhitespaceName } from "./normalize";
import type {
  FiOrganisationRow,
  FoundationSupabase,
  ResolveOrganisationInput,
  ResolveOrganisationResult,
} from "./types";

/** Insert source mapping when source id present; returns true if a new row was inserted. */
async function ensureOrganisationSourceMapping(
  supabase: SupabaseClient,
  tenantId: string,
  organisationId: string,
  sourceSystem: string,
  sourceOrgId: string | null
): Promise<boolean> {
  if (!sourceOrgId) return false;
  const { error } = await supabase.from("fi_organisation_source_ids").insert({
    tenant_id: tenantId,
    organisation_id: organisationId,
    source_system: sourceSystem,
    source_organisation_id: sourceOrgId,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

function asOrgRow(row: Record<string, unknown>): FiOrganisationRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    slug: row.slug == null ? null : String(row.slug),
    organisation_type: row.organisation_type as FiOrganisationRow["organisation_type"],
    metadata:
      (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Idempotent: source mapping → single exact name match within tenant → create.
 * Does not fuzzy-match names when multiple rows could match (creates new instead).
 */
export async function resolveOrCreateOrganisation(
  input: ResolveOrganisationInput,
  client?: FoundationSupabase
): Promise<ResolveOrganisationResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const sourceSystem = input.source_system.trim();
  const sourceOrgId = input.source_organisation_id?.trim() || null;
  const orgType = input.type ?? "other";
  const displayName = input.name?.trim() || "Unknown organisation";

  if (sourceOrgId) {
    const mapped = await supabase
      .from("fi_organisation_source_ids")
      .select("organisation_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_organisation_id", sourceOrgId)
      .maybeSingle();

    if (mapped.error) throw new Error(mapped.error.message);
    if (mapped.data?.organisation_id) {
      const org = await supabase
        .from("fi_organisations")
        .select("id, tenant_id, name, slug, organisation_type, metadata, created_at, updated_at")
        .eq("id", mapped.data.organisation_id)
        .eq("tenant_id", tenantId)
        .single();
      if (org.error || !org.data)
        throw new Error(org.error?.message ?? "Organisation not found for mapping.");
      return {
        organisation: asOrgRow(org.data as Record<string, unknown>),
        created: false,
        mapping_created: false,
      };
    }
  }

  const normName = normalizeWhitespaceName(input.name ?? displayName);
  if (normName) {
    const { data: candidates, error: listErr } = await supabase
      .from("fi_organisations")
      .select("id, tenant_id, name, slug, organisation_type, metadata, created_at, updated_at")
      .eq("tenant_id", tenantId);
    if (listErr) throw new Error(listErr.message);
    const rows = (candidates ?? []) as Record<string, unknown>[];
    const matches = rows.filter((r) => normalizeWhitespaceName(String(r.name)) === normName);
    if (matches.length === 1) {
      const org = asOrgRow(matches[0]);
      const mappingCreated = await ensureOrganisationSourceMapping(
        supabase,
        tenantId,
        org.id,
        sourceSystem,
        sourceOrgId
      );
      return { organisation: org, created: false, mapping_created: mappingCreated };
    }
  }

  const slug = slugifyOptional(displayName);
  const metadata = shallowMergeMetadata(
    {
      ...(input.metadata ?? {}),
      resolution_source: "foundation_resolveOrCreateOrganisation",
    },
    normName ? { normalised_name: normName } : null
  );

  const insertRow = {
    tenant_id: tenantId,
    name: displayName,
    slug,
    organisation_type: orgType,
    metadata,
  };

  let inserted = await supabase
    .from("fi_organisations")
    .insert(insertRow)
    .select("id, tenant_id, name, slug, organisation_type, metadata, created_at, updated_at")
    .single();

  if (inserted.error?.code === "23505" && slug) {
    inserted = await supabase
      .from("fi_organisations")
      .insert({ ...insertRow, slug: null })
      .select("id, tenant_id, name, slug, organisation_type, metadata, created_at, updated_at")
      .single();
  }

  if (!inserted.error && inserted.data) {
    let mappingCreated = false;
    if (sourceOrgId) {
      const mapIns = await supabase.from("fi_organisation_source_ids").insert({
        tenant_id: tenantId,
        organisation_id: (inserted.data as { id: string }).id,
        source_system: sourceSystem,
        source_organisation_id: sourceOrgId,
      });
      if (mapIns.error && mapIns.error.code !== "23505") throw new Error(mapIns.error.message);
      mappingCreated = !mapIns.error;
    }
    return {
      organisation: asOrgRow(inserted.data as Record<string, unknown>),
      created: true,
      mapping_created: mappingCreated,
    };
  }

  if (inserted.error?.code === "23505" && sourceOrgId) {
    const retry = await supabase
      .from("fi_organisation_source_ids")
      .select("organisation_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_organisation_id", sourceOrgId)
      .maybeSingle();
    if (retry.data?.organisation_id) {
      const org = await supabase
        .from("fi_organisations")
        .select("id, tenant_id, name, slug, organisation_type, metadata, created_at, updated_at")
        .eq("id", retry.data.organisation_id)
        .eq("tenant_id", tenantId)
        .single();
      if (org.data) {
        return {
          organisation: asOrgRow(org.data as Record<string, unknown>),
          created: false,
          mapping_created: false,
        };
      }
    }
  }

  throw new Error(inserted.error?.message ?? "Failed to create organisation.");
}
