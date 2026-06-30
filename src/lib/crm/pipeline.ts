import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildDefaultPipelineStageInsertRows,
  sortPipelineStagesByOrder,
} from "./pipelineSeedPayload";
import type { CrmPipelineScope, FiCrmPipelineStageRow } from "./types";
import { DEFAULT_CRM_PIPELINE_KEY } from "./types";
import { normaliseOrgClinicScope } from "./scope";

function asStageRow(row: Record<string, unknown>): FiCrmPipelineStageRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    organisation_id: row.organisation_id != null ? String(row.organisation_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    pipeline_key: String(row.pipeline_key),
    slug: String(row.slug),
    label: String(row.label),
    sort_order: Number(row.sort_order),
    is_entry: Boolean(row.is_entry),
    is_won: Boolean(row.is_won),
    is_lost: Boolean(row.is_lost),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Load pipeline stages for a tenant/org/clinic + pipeline_key scope (service role).
 */
export async function loadPipelineStages(
  scope: CrmPipelineScope,
  client?: SupabaseClient
): Promise<FiCrmPipelineStageRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = scope.tenantId.trim();
  const { organisationId, clinicId } = normaliseOrgClinicScope({
    organisationId: scope.organisationId,
    clinicId: scope.clinicId,
  });
  const pipelineKey =
    (scope.pipelineKey ?? DEFAULT_CRM_PIPELINE_KEY).trim() || DEFAULT_CRM_PIPELINE_KEY;

  let q = supabase
    .from("fi_crm_pipeline_stages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("pipeline_key", pipelineKey);

  if (organisationId === null) q = q.is("organisation_id", null);
  else q = q.eq("organisation_id", organisationId);

  if (clinicId === null) q = q.is("clinic_id", null);
  else q = q.eq("clinic_id", clinicId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  return sortPipelineStagesByOrder(rows.map(asStageRow));
}

export type EnsureDefaultPipelineStagesResult = {
  /** True when this call performed the initial insert for the scope. */
  seeded: boolean;
  stages: FiCrmPipelineStageRow[];
};

/**
 * Idempotent lazy seed: if any stage exists for the scope + pipeline_key, returns existing rows only.
 * Otherwise inserts the default hair-restoration stage set for that scope only (never all tenants).
 */
export async function ensureDefaultPipelineStages(
  scope: CrmPipelineScope,
  client?: SupabaseClient
): Promise<EnsureDefaultPipelineStagesResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = scope.tenantId.trim();
  const { organisationId, clinicId } = normaliseOrgClinicScope({
    organisationId: scope.organisationId,
    clinicId: scope.clinicId,
  });
  const pipelineKey =
    (scope.pipelineKey ?? DEFAULT_CRM_PIPELINE_KEY).trim() || DEFAULT_CRM_PIPELINE_KEY;

  const existing = await loadPipelineStages(
    { tenantId, organisationId, clinicId, pipelineKey },
    supabase
  );
  if (existing.length > 0) {
    return { seeded: false, stages: existing };
  }

  const insertRows = buildDefaultPipelineStageInsertRows({
    tenantId,
    organisationId,
    clinicId,
    pipelineKey,
  });

  const { error: insertError } = await supabase.from("fi_crm_pipeline_stages").insert(insertRows);
  if (insertError) {
    // Concurrent first requests: unique index / race — reload and treat as already seeded.
    if (insertError.code === "23505") {
      const after = await loadPipelineStages(
        { tenantId, organisationId, clinicId, pipelineKey },
        supabase
      );
      return { seeded: false, stages: after };
    }
    throw new Error(insertError.message);
  }

  const stages = await loadPipelineStages(
    { tenantId, organisationId, clinicId, pipelineKey },
    supabase
  );
  return { seeded: true, stages };
}

/** Returns the single entry stage for a scope, or null if none (misconfigured tenant data). */
export async function getEntryPipelineStage(
  scope: CrmPipelineScope,
  client?: SupabaseClient
): Promise<FiCrmPipelineStageRow | null> {
  const stages = await loadPipelineStages(scope, client);
  const entry = stages.find((s) => s.is_entry);
  return entry ?? null;
}
