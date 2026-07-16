"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import {
  applyOwnerResolutionBatch,
  loadOwnerResolutionWorkspace,
  previewOwnerResolutionApplyBatch,
  saveOwnerResolutionDecision,
} from "@/src/lib/integrations/hubspot/import/hubspotOwnerResolution.server";
import type {
  HubspotOwnerResolutionDecisionInput,
  HubspotOwnerResolutionFilter,
} from "@/src/lib/integrations/hubspot/import/hubspotOwnerResolutionTypes";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";
import { hubspotWorkspaceHref } from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function assertOwnerResolutionView(tenantId: string): Promise<void> {
  await assertCrmTenantReadAllowed({ tenantId, request: undefined });
  const canManage = await canViewTenantConfigurationHub(tenantId);
  if (!canManage) {
    throw new CrmAccessError(
      403,
      "Owner resolution is limited to clinic administrators and authorised migration operators."
    );
  }
}

async function assertOwnerResolutionMutate(tenantId: string): Promise<void> {
  await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
  const canManage = await canViewTenantConfigurationHub(tenantId);
  if (!canManage) {
    throw new CrmAccessError(
      403,
      "Owner resolution is limited to clinic administrators and authorised migration operators."
    );
  }
}

export async function loadHubspotOwnerResolutionWorkspaceAction(
  tenantId: string,
  filter: HubspotOwnerResolutionFilter = "needs_attention",
  search?: string
) {
  try {
    await assertOwnerResolutionView(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await loadOwnerResolutionWorkspace(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      filter,
      search,
    });
    return { ok: true as const, data, integrationId: integration.data.integrationId };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function saveHubspotOwnerResolutionDecisionAction(
  tenantId: string,
  decision: HubspotOwnerResolutionDecisionInput
) {
  try {
    await assertOwnerResolutionMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId, null);
    const result = await saveOwnerResolutionDecision(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      decision,
      operatorFiUserId: fiUserId,
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "owner-resolution"));
    return { ok: true as const, decisionId: result.decisionId };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function previewHubspotOwnerResolutionBatchAction(tenantId: string) {
  try {
    await assertOwnerResolutionMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const preview = await previewOwnerResolutionApplyBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      maxMappings: 10,
      operatorLabel: "workspace-preview",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "owner-resolution"));
    return { ok: true as const, preview };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function applyHubspotOwnerResolutionBatchAction(
  tenantId: string,
  approvedBatchId: string,
  expectedChecksum: string,
  confirmBatchId: string
) {
  try {
    await assertOwnerResolutionMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    if (confirmBatchId !== approvedBatchId) {
      return {
        ok: false as const,
        error: "Confirmation did not match the approved batch. Nothing was applied.",
      };
    }
    const result = await applyOwnerResolutionBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      approvedBatchId,
      confirmToken: confirmBatchId,
      expectedChecksum,
      actorLabel: "workspace-apply",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "owner-resolution"));
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
