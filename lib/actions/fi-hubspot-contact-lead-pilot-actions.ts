"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import {
  applyContactLeadPilotBatch,
  loadContactLeadPilotWorkspace,
  previewContactLeadPilotBatch,
  saveContactLeadPilotDecision,
} from "@/src/lib/integrations/hubspot/import/hubspotContactLeadPilot.server";
import type {
  HubspotContactLeadPilotDecisionInput,
  HubspotContactLeadPilotFilter,
} from "@/src/lib/integrations/hubspot/import/hubspotContactLeadPilotTypes";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";
import { hubspotWorkspaceHref } from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function assertPilotView(tenantId: string): Promise<void> {
  await assertCrmTenantReadAllowed({ tenantId, request: undefined });
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    throw new CrmAccessError(
      403,
      "Lead pilot is limited to clinic administrators and authorised migration operators."
    );
  }
}

async function assertPilotMutate(tenantId: string): Promise<void> {
  await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    throw new CrmAccessError(
      403,
      "Lead pilot is limited to clinic administrators and authorised migration operators."
    );
  }
}

export async function loadHubspotContactLeadPilotWorkspaceAction(
  tenantId: string,
  filter: HubspotContactLeadPilotFilter = "all",
  search?: string,
  rebuildCohort = false
) {
  try {
    await assertPilotView(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await loadContactLeadPilotWorkspace(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      filter,
      search,
      rebuildCohort,
    });
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function saveHubspotContactLeadPilotDecisionAction(
  tenantId: string,
  decision: HubspotContactLeadPilotDecisionInput
) {
  try {
    await assertPilotMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId, null);
    const result = await saveContactLeadPilotDecision(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      decision,
      operatorFiUserId: fiUserId,
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "lead-pilot"));
    return { ok: true as const, decisionId: result.decisionId };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function previewHubspotContactLeadPilotBatchAction(tenantId: string) {
  try {
    await assertPilotMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const preview = await previewContactLeadPilotBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      operatorLabel: "workspace-preview",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "lead-pilot"));
    return { ok: true as const, preview };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function applyHubspotContactLeadPilotBatchAction(
  tenantId: string,
  approvedBatchId: string,
  expectedChecksum: string,
  confirmBatchId: string
) {
  try {
    await assertPilotMutate(tenantId);
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
    const result = await applyContactLeadPilotBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      approvedBatchId,
      confirmToken: confirmBatchId,
      expectedChecksum,
      actorLabel: "workspace-apply",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "lead-pilot"));
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
