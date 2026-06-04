import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCaseExternalId } from "@/lib/fi/events/mapping";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "./internal";
import type {
  FiCaseRowMinimal,
  FoundationSupabase,
  ResolveCaseFoundationInput,
  ResolveCaseFoundationResult,
} from "./types";

function asCaseRow(row: Record<string, unknown>): FiCaseRowMinimal {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    status: String(row.status),
    external_id: row.external_id == null ? null : String(row.external_id),
    foundation_patient_id: row.foundation_patient_id == null ? null : String(row.foundation_patient_id),
    clinic_id: row.clinic_id == null ? null : String(row.clinic_id),
    organisation_id: row.organisation_id == null ? null : String(row.organisation_id),
    metadata: (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Idempotent: patch existing case, or resolve via fi_global_cases / external_id, or create fi_cases.
 * Aligns with ingest external_id pattern `source_system:source_case_id`.
 */
export async function resolveOrCreateCaseFoundation(
  input: ResolveCaseFoundationInput,
  client?: FoundationSupabase
): Promise<ResolveCaseFoundationResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = input.tenant_id.trim();
  const sourceSystem = input.source_system.trim();
  const sourceCaseId = input.source_case_id?.trim() || null;

  if (input.existing_case_id?.trim()) {
    const id = input.existing_case_id.trim();
    const existing = await supabase
      .from("fi_cases")
      .select(
        "id, tenant_id, status, external_id, foundation_patient_id, clinic_id, organisation_id, metadata, created_at, updated_at"
      )
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();
    if (existing.error || !existing.data) throw new Error(existing.error?.message ?? "Case not found.");

    const row = existing.data as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.foundation_patient_id && row.foundation_patient_id == null) {
      patch.foundation_patient_id = input.foundation_patient_id.trim();
    }
    if (input.clinic_id && row.clinic_id == null) {
      patch.clinic_id = input.clinic_id.trim();
    }
    if (input.organisation_id && row.organisation_id == null) {
      patch.organisation_id = input.organisation_id.trim();
    }
    const nextMeta = shallowMergeMetadata((row.metadata as Record<string, unknown>) ?? {}, {
      ...(input.metadata ?? {}),
      ...(input.case_type ? { case_type: input.case_type } : {}),
    });
    if ((input.metadata && Object.keys(input.metadata).length > 0) || input.case_type) {
      patch.metadata = nextMeta;
    }
    if (input.status && typeof input.status === "string") {
      patch.status = input.status;
    }

    const updated = await supabase.from("fi_cases").update(patch).eq("id", id).select().single();
    if (updated.error) throw new Error(updated.error.message);
    return { case: asCaseRow(updated.data as Record<string, unknown>), created: false, updated: true };
  }

  if (sourceCaseId) {
    const gc = await supabase
      .from("fi_global_cases")
      .select("fi_case_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", sourceSystem)
      .eq("source_case_id", sourceCaseId)
      .maybeSingle();
    if (gc.error) throw new Error(gc.error.message);
    if (gc.data?.fi_case_id) {
      const row = await supabase
        .from("fi_cases")
        .select(
          "id, tenant_id, status, external_id, foundation_patient_id, clinic_id, organisation_id, metadata, created_at, updated_at"
        )
        .eq("id", gc.data.fi_case_id)
        .eq("tenant_id", tenantId)
        .single();
      if (row.data) {
        return { case: asCaseRow(row.data as Record<string, unknown>), created: false, updated: false };
      }
    }

    const externalId = buildCaseExternalId(sourceSystem, sourceCaseId);
    const byExt = await supabase
      .from("fi_cases")
      .select(
        "id, tenant_id, status, external_id, foundation_patient_id, clinic_id, organisation_id, metadata, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .eq("external_id", externalId)
      .maybeSingle();
    if (byExt.error) throw new Error(byExt.error.message);
    if (byExt.data) {
      return { case: asCaseRow(byExt.data as Record<string, unknown>), created: false, updated: false };
    }
  }

  if (!sourceCaseId) {
    throw new Error("resolveOrCreateCaseFoundation: source_case_id is required when existing_case_id is absent.");
  }

  const externalId = buildCaseExternalId(sourceSystem, sourceCaseId);
  const metadata = shallowMergeMetadata(
    {
      source_system: sourceSystem,
      source_case_id: sourceCaseId,
      ...(input.metadata ?? {}),
      ...(input.case_type ? { case_type: input.case_type } : {}),
      resolution_source: "foundation_resolveOrCreateCaseFoundation",
    },
    null
  );

  const inserted = await supabase
    .from("fi_cases")
    .insert({
      tenant_id: tenantId,
      external_id: externalId,
      status: input.status ?? "draft",
      foundation_patient_id: input.foundation_patient_id?.trim() || null,
      clinic_id: input.clinic_id?.trim() || null,
      organisation_id: input.organisation_id?.trim() || null,
      metadata,
    })
    .select(
      "id, tenant_id, status, external_id, foundation_patient_id, clinic_id, organisation_id, metadata, created_at, updated_at"
    )
    .single();

  if (inserted.error?.code === "23505") {
    const retry = await supabase
      .from("fi_cases")
      .select(
        "id, tenant_id, status, external_id, foundation_patient_id, clinic_id, organisation_id, metadata, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .eq("external_id", externalId)
      .single();
    if (retry.data) {
      return { case: asCaseRow(retry.data as Record<string, unknown>), created: false, updated: false };
    }
  }

  if (inserted.error) throw new Error(inserted.error.message);
  return { case: asCaseRow(inserted.data as Record<string, unknown>), created: true, updated: false };
}
