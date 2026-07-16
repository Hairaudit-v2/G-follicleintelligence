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
  applyContactLeadExpansionBatch,
  loadContactLeadExpansionWorkspace,
  previewContactLeadExpansionBatch,
  reconcileContactLeadExpansionBatch,
  saveContactLeadExpansionDecision,
  selectAndPersistExpansionBatch,
} from "@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server";
import type {
  HubspotContactLeadExpansionDecisionInput,
  HubspotContactLeadExpansionFilter,
} from "@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansionTypes";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";
import { hubspotWorkspaceHref } from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function assertMigrationView(tenantId: string): Promise<void> {
  await assertCrmTenantReadAllowed({ tenantId, request: undefined });
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    throw new CrmAccessError(
      403,
      "Contact migration is limited to clinic administrators and authorised migration operators."
    );
  }
}

async function assertMigrationMutate(tenantId: string): Promise<void> {
  await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    throw new CrmAccessError(
      403,
      "Contact migration is limited to clinic administrators and authorised migration operators."
    );
  }
}

export async function loadHubspotContactMigrationWorkspaceAction(
  tenantId: string,
  filter: HubspotContactLeadExpansionFilter = "all",
  search?: string
) {
  try {
    await assertMigrationView(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await loadContactLeadExpansionWorkspace(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      filter,
      search,
    });
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function saveHubspotContactMigrationDecisionAction(
  tenantId: string,
  decision: HubspotContactLeadExpansionDecisionInput
) {
  try {
    await assertMigrationMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const fiUserId = await tryResolveFiUserIdForTenant(tenantId, null);
    const result = await saveContactLeadExpansionDecision(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      decision,
      operatorFiUserId: fiUserId,
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "contact-migration"));
    return { ok: true as const, decisionId: result.decisionId };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function selectHubspotContactMigrationBatchAction(
  tenantId: string,
  maxSize?: number
) {
  try {
    await assertMigrationMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const result = await selectAndPersistExpansionBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      maxSize,
      operatorLabel: "workspace-select",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "contact-migration"));
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function previewHubspotContactMigrationBatchAction(tenantId: string) {
  try {
    await assertMigrationMutate(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const preview = await previewContactLeadExpansionBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      operatorLabel: "workspace-preview",
      maxSize: 100,
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "contact-migration"));
    return { ok: true as const, preview };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function applyHubspotContactMigrationBatchAction(
  tenantId: string,
  approvedBatchId: string,
  expectedChecksum: string,
  confirmBatchId: string
) {
  try {
    await assertMigrationMutate(tenantId);
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
    const result = await applyContactLeadExpansionBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      approvedBatchId,
      confirmToken: confirmBatchId,
      expectedChecksum,
      actorLabel: "workspace-apply",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "contact-migration"));
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function reconcileHubspotContactMigrationBatchAction(
  tenantId: string,
  batchId: string
) {
  try {
    await assertMigrationMutate(tenantId);
    const reconciliation = await reconcileContactLeadExpansionBatch(supabaseAdmin(), {
      tenantId,
      batchId,
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "contact-migration"));
    return { ok: true as const, reconciliation };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
