"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  CrmAccessError,
} from "@/src/lib/crm/crmGate";
import {
  buildPatientLinkReviewWorkspace,
  persistPatientLinkReview,
  previewPatientLinkBatch,
} from "@/src/lib/integrations/hubspot/import/hubspotPatientLinkReview.server";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";
import { hubspotWorkspaceHref } from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

const ONE_E_P_INVENTORY =
  "93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451";
const ONE_E_P_CUTOFF = "2026-07-16T16:00:34.530Z";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function assertPatientReviewAccess(tenantId: string): Promise<void> {
  await assertCrmTenantReadAllowed({ tenantId, request: undefined });
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    throw new CrmAccessError(
      403,
      "Patient-link review is limited to authorised clinical identity roles for this clinic."
    );
  }
}

export async function loadHubspotPatientReviewWorkspaceAction(tenantId: string) {
  try {
    await assertPatientReviewAccess(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await buildPatientLinkReviewWorkspace(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      fixedInventoryChecksum: ONE_E_P_INVENTORY,
      sourceCutoff: ONE_E_P_CUTOFF,
      operatorLabel: "workspace-patient-review",
      actorRole: "clinic_admin",
    });
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function persistHubspotPatientReviewAction(tenantId: string) {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    await assertPatientReviewAccess(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await persistPatientLinkReview(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      fixedInventoryChecksum: ONE_E_P_INVENTORY,
      sourceCutoff: ONE_E_P_CUTOFF,
      operatorLabel: "workspace-patient-review-persist",
      actorRole: "clinic_admin",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "patient-review"));
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function previewHubspotPatientReviewAction(tenantId: string) {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    await assertPatientReviewAccess(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const preview = await previewPatientLinkBatch(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      fixedInventoryChecksum: ONE_E_P_INVENTORY,
      sourceCutoff: ONE_E_P_CUTOFF,
      operatorLabel: "workspace-patient-review-preview",
      actorRole: "clinic_admin",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "patient-review"));
    return { ok: true as const, preview };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
