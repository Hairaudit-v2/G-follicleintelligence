import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  organisationBelongsToTenant,
  clinicBelongsToTenant,
} from "@/src/lib/fi/foundation/tenantSettings";
import { appendCrmActivityEvent } from "./activity";
import { publishLeadFlowEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import {
  collectChangedLeadDetailKeys,
  leadDetailSnapshotsEqual,
  type LeadDetailComparableSnapshot,
} from "./crmLeadDetailsPolicy";
import { loadCrmLeadById } from "./leads";
import { mapFiCrmLeadRow } from "./leadRow";
import type { FiCrmLeadRow } from "./types";
import { isFiAdminApiKeyMatch } from "./crmFiAdminApiKeyMatch";

export type UpdateCrmLeadDetailsInput = {
  tenantId: string;
  leadId: string;
  summary: string;
  status: string;
  priority: string | null;
  primaryOwnerUserId: string | null;
  organisationId: string | null;
  clinicId: string | null;
  /** When set, replaces lead metadata. When undefined, metadata is unchanged (except optional admin merge). */
  metadata?: Record<string, unknown>;
  /** Shallow-merged onto metadata after main `metadata` replace; only applied when `fiAdminKey` matches env. */
  adminMetadataMerge?: Record<string, unknown> | null;
  fiAdminKey?: string | null;
};

async function fiUserBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", fiUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Updates editable lead columns (never `current_stage_id`). Appends `lead.updated` activity when something changed.
 */
export async function updateCrmLeadDetails(
  params: UpdateCrmLeadDetailsInput,
  client?: SupabaseClient
): Promise<FiCrmLeadRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = params.tenantId.trim();
  const leadId = params.leadId.trim();

  const lead = await loadCrmLeadById(leadId, tenantId, supabase);
  if (!lead) throw new Error("Lead not found.");

  const summaryTrimmed = params.summary.trim();
  if (!summaryTrimmed) throw new Error("Lead summary is required.");

  const orgId = params.organisationId?.trim() || null;
  const clinicId = params.clinicId?.trim() || null;
  const ownerId = params.primaryOwnerUserId?.trim() || null;

  if (orgId) {
    const ok = await organisationBelongsToTenant(tenantId, orgId, supabase);
    if (!ok) throw new Error("Organisation not found for this tenant.");
  }
  if (clinicId) {
    const ok = await clinicBelongsToTenant(tenantId, clinicId, supabase);
    if (!ok) throw new Error("Clinic not found for this tenant.");
    if (orgId) {
      const { data: clinicRow, error: cErr } = await supabase
        .from("fi_clinics")
        .select("organisation_id")
        .eq("tenant_id", tenantId)
        .eq("id", clinicId)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      const cOrg =
        (clinicRow as { organisation_id: string | null } | null)?.organisation_id ?? null;
      if (cOrg && cOrg !== orgId) {
        throw new Error("Selected clinic does not belong to the selected organisation.");
      }
    }
  }
  if (ownerId) {
    const ok = await fiUserBelongsToTenant(supabase, tenantId, ownerId);
    if (!ok) throw new Error("Owner must be a user in this tenant.");
  }

  const merge =
    params.adminMetadataMerge && Object.keys(params.adminMetadataMerge).length > 0
      ? params.adminMetadataMerge
      : null;
  if (
    merge &&
    !isFiAdminApiKeyMatch(params.fiAdminKey ?? undefined, process.env.FI_ADMIN_API_KEY)
  ) {
    throw new Error("FI admin key required to apply admin metadata merge.");
  }

  let nextMetadata: Record<string, unknown> = { ...lead.metadata };
  if (params.metadata !== undefined) {
    nextMetadata = { ...params.metadata };
  }
  if (merge) {
    nextMetadata = { ...nextMetadata, ...merge };
  }

  const before: LeadDetailComparableSnapshot = {
    summary: lead.summary?.trim() ?? "",
    status: lead.status,
    priority: lead.priority,
    primary_owner_user_id: lead.primary_owner_user_id,
    organisation_id: lead.organisation_id,
    clinic_id: lead.clinic_id,
    metadata: lead.metadata,
  };

  const after: LeadDetailComparableSnapshot = {
    summary: summaryTrimmed,
    status: params.status.trim(),
    priority: params.priority,
    primary_owner_user_id: ownerId,
    organisation_id: orgId,
    clinic_id: clinicId,
    metadata: nextMetadata,
  };

  if (leadDetailSnapshotsEqual(before, after)) {
    return lead;
  }

  const changedKeys = collectChangedLeadDetailKeys(before, after);

  const { data: updated, error: upErr } = await supabase
    .from("fi_crm_leads")
    .update({
      summary: summaryTrimmed,
      status: params.status.trim(),
      priority: params.priority,
      primary_owner_user_id: ownerId,
      organisation_id: orgId,
      clinic_id: clinicId,
      metadata: nextMetadata,
    })
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (upErr) throw new Error(upErr.message);

  const out = mapFiCrmLeadRow(updated as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "lead.updated",
      title: "Lead details updated",
      detail: { changed_keys: changedKeys },
      patientId: out.patient_id,
      caseId: out.case_id,
    },
    supabase
  );

  const scoringChanged = changedKeys.includes("priority") || changedKeys.includes("metadata");
  if (scoringChanged) {
    const meta =
      out.metadata && typeof out.metadata === "object" && !Array.isArray(out.metadata)
        ? (out.metadata as Record<string, unknown>)
        : {};
    const scoreValue =
      typeof meta.lead_score === "number"
        ? meta.lead_score
        : typeof meta.conversion_probability === "number"
          ? Math.round(meta.conversion_probability * 100)
          : null;

    void publishLeadFlowEvent({
      tenantId,
      clinicId: out.clinic_id,
      eventType: "lead_scored",
      entityId: leadId,
      entityType: "lead",
      eventValue: scoreValue,
      eventMetadata: {
        priority: out.priority,
        stage: out.current_stage_id,
        score: scoreValue,
        changed_keys: changedKeys,
      },
    });
  }

  return out;
}
