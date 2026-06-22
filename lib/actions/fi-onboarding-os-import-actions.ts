"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  cancelHubspotImport,
  createFiLeadFromHubspotContact,
  createFiOpportunityFromHubspotDeal,
  loadHubspotIntegrationForTenant,
  loadImportReviewQueue,
  mergeHubspotContactWithExisting,
  type ImportReviewItem,
} from "@/src/lib/onboarding-os/hubspotImport.server";

export type ImportReviewActionResult =
  | { ok: true; items?: ImportReviewItem[]; integrationId?: string; integrationLabel?: string }
  | { ok: false; error: string };

const tenantIdSchema = z.string().uuid();
const integrationIdSchema = z.string().uuid();
const stagingIdSchema = z.string().uuid();
const personIdSchema = z.string().uuid();

function revalidateImportPaths(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId}/onboarding-os/import-review`);
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  revalidatePath("/fi-admin/platform/onboarding");
}

export async function loadImportReviewQueueAction(
  tenantId: string,
  integrationId?: string | null
): Promise<ImportReviewActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    let iid = integrationId?.trim();
    let integrationLabel = "HubSpot";

    if (!iid) {
      const loaded = await loadHubspotIntegrationForTenant(tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      });
      if (!loaded.ok) return loaded;
      iid = loaded.data!.integrationId;
      integrationLabel = loaded.data!.label;
    } else {
      integrationIdSchema.parse(iid);
    }

    const result = await loadImportReviewQueue(iid, tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    return {
      ok: true,
      items: result.data!.items,
      integrationId: iid,
      integrationLabel,
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load import review queue." };
  }
}

export async function importHubspotContactAction(
  tenantId: string,
  integrationId: string,
  stagingContactId: string
): Promise<ImportReviewActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingContactId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await createFiLeadFromHubspotContact(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateImportPaths(tid);
    return { ok: true, integrationId: iid };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }
}

export async function importHubspotDealAction(
  tenantId: string,
  integrationId: string,
  stagingDealId: string
): Promise<ImportReviewActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingDealId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await createFiOpportunityFromHubspotDeal(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateImportPaths(tid);
    return { ok: true, integrationId: iid };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Deal import failed." };
  }
}

export async function cancelHubspotImportAction(
  tenantId: string,
  integrationId: string,
  kind: "contact" | "deal",
  stagingId: string
): Promise<ImportReviewActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingId);
    if (kind !== "contact" && kind !== "deal") return { ok: false, error: "Invalid record kind." };

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await cancelHubspotImport(kind, sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateImportPaths(tid);
    return { ok: true, integrationId: iid };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Cancel failed." };
  }
}

export async function mergeHubspotContactAction(
  tenantId: string,
  integrationId: string,
  stagingContactId: string,
  existingPersonId: string
): Promise<ImportReviewActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingContactId);
    const pid = personIdSchema.parse(existingPersonId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await mergeHubspotContactWithExisting(sid, iid, tid, pid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateImportPaths(tid);
    return { ok: true, integrationId: iid };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Merge failed." };
  }
}
