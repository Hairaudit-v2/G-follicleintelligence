"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  CrmAccessError,
} from "@/src/lib/crm/crmGate";
import {
  buildQuarantineReviewWorkspace,
  persistQuarantineReview,
} from "@/src/lib/integrations/hubspot/import/hubspotQuarantineReview.server";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";
import { hubspotWorkspaceHref } from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

const ONE_E_Q_INVENTORY =
  "fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6";
const ONE_E_Q_CUTOFF = "2026-07-16T16:00:34.530Z";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function assertQuarantineReviewAccess(tenantId: string): Promise<void> {
  await assertCrmTenantReadAllowed({ tenantId, request: undefined });
  if (!(await canViewTenantConfigurationHub(tenantId))) {
    throw new CrmAccessError(
      403,
      "Quarantine review is limited to authorised configuration roles for this clinic."
    );
  }
}

export async function loadHubspotQuarantineReviewWorkspaceAction(tenantId: string) {
  try {
    await assertQuarantineReviewAccess(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await buildQuarantineReviewWorkspace(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      fixedInventoryChecksum: ONE_E_Q_INVENTORY,
      sourceCutoff: ONE_E_Q_CUTOFF,
      operatorLabel: "workspace-quarantine-review",
      actorRole: "clinic_admin",
    });
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export async function persistHubspotQuarantineReviewAction(tenantId: string) {
  try {
    await assertCrmTenantWriteAllowed({ tenantId, request: undefined });
    await assertQuarantineReviewAccess(tenantId);
    const integration = await loadHubspotIntegrationForTenant(tenantId);
    if (!integration.ok || !integration.data) {
      return { ok: false as const, error: "HubSpot is not configured for this clinic." };
    }
    const data = await persistQuarantineReview(supabaseAdmin(), {
      tenantId,
      integrationId: integration.data.integrationId,
      fixedInventoryChecksum: ONE_E_Q_INVENTORY,
      sourceCutoff: ONE_E_Q_CUTOFF,
      operatorLabel: "workspace-quarantine-review-persist",
      actorRole: "clinic_admin",
    });
    revalidatePath(hubspotWorkspaceHref(tenantId, "quarantine-review"));
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
