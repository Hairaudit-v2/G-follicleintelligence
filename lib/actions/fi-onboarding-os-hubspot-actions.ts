"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  approveHubspotDeal,
  approveHubspotLead,
  loadHubspotConnectorSnapshot,
  loadHubspotStagingContacts,
  loadHubspotStagingDeals,
  loadHubspotSyncRuns,
  rejectHubspotDeal,
  rejectHubspotLead,
  runHubspotSync,
} from "@/src/lib/onboarding-os/hubspotConnector.server";
import type { HubspotConnectorSnapshot } from "@/src/lib/onboarding-os/hubspotConnectorTypes";

export type HubspotActionResult =
  | { ok: true; snapshot?: HubspotConnectorSnapshot }
  | { ok: false; error: string };

const tenantIdSchema = z.string().uuid();
const integrationIdSchema = z.string().uuid();
const stagingIdSchema = z.string().uuid();

function revalidateHubspotPaths(tenantId: string, sessionId?: string | null) {
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  if (sessionId) {
    revalidatePath(`/fi-admin/platform/onboarding/${sessionId}`);
  }
  revalidatePath("/fi-admin/platform/onboarding");
}

async function loadSnapshotForIntegration(
  integrationId: string,
  tenantId: string,
  authId: string,
  isPlatform: boolean
): Promise<HubspotConnectorSnapshot | undefined> {
  const loaded = await loadHubspotConnectorSnapshot(integrationId, tenantId, {
    actorAuthUserId: authId,
    allowTenantMemberRead: true,
    skipAuthCheck: isPlatform,
  });
  return loaded.ok ? loaded.snapshot : undefined;
}

export async function loadHubspotConnectorSnapshotAction(
  tenantId: string,
  integrationId: string
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await loadHubspotConnectorSnapshot(iid, tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load HubSpot connector.",
    };
  }
}

export async function runHubspotSyncAction(
  tenantId: string,
  integrationId: string,
  sessionId?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await runHubspotSync(iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateHubspotPaths(tid, sessionId);
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "HubSpot sync failed." };
  }
}

export async function approveHubspotLeadAction(
  tenantId: string,
  integrationId: string,
  stagingContactId: string,
  sessionId?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingContactId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await approveHubspotLead(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateHubspotPaths(tid, sessionId);
    const snapshot = await loadSnapshotForIntegration(iid, tid, authId, isPlatform);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve lead." };
  }
}

export async function rejectHubspotLeadAction(
  tenantId: string,
  integrationId: string,
  stagingContactId: string,
  sessionId?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingContactId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await rejectHubspotLead(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateHubspotPaths(tid, sessionId);
    const snapshot = await loadSnapshotForIntegration(iid, tid, authId, isPlatform);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reject lead." };
  }
}

export async function approveHubspotDealAction(
  tenantId: string,
  integrationId: string,
  stagingDealId: string,
  sessionId?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingDealId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await approveHubspotDeal(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateHubspotPaths(tid, sessionId);
    const snapshot = await loadSnapshotForIntegration(iid, tid, authId, isPlatform);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve deal." };
  }
}

export async function rejectHubspotDealAction(
  tenantId: string,
  integrationId: string,
  stagingDealId: string,
  sessionId?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingIdSchema.parse(stagingDealId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await rejectHubspotDeal(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateHubspotPaths(tid, sessionId);
    const snapshot = await loadSnapshotForIntegration(iid, tid, authId, isPlatform);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reject deal." };
  }
}

export async function loadHubspotStagingContactsAction(
  tenantId: string,
  integrationId: string,
  importStatus?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const [snapshotRes, contactsRes] = await Promise.all([
      loadHubspotConnectorSnapshot(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      }),
      loadHubspotStagingContacts(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
        importStatus: importStatus ?? undefined,
      }),
    ]);

    if (!snapshotRes.ok) return snapshotRes;
    if (!contactsRes.ok) return contactsRes;

    return {
      ok: true,
      snapshot: {
        ...snapshotRes.snapshot,
        contactQueue: contactsRes.contacts,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load staging contacts.",
    };
  }
}

export async function loadHubspotSyncRunsAction(
  tenantId: string,
  integrationId: string
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const [snapshotRes, runsRes] = await Promise.all([
      loadHubspotConnectorSnapshot(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      }),
      loadHubspotSyncRuns(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      }),
    ]);

    if (!snapshotRes.ok) return snapshotRes;
    if (!runsRes.ok) return runsRes;

    return {
      ok: true,
      snapshot: {
        ...snapshotRes.snapshot,
        recentSyncRuns: runsRes.runs,
        latestSyncRun: runsRes.runs[0] ?? null,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load sync runs." };
  }
}

export async function loadHubspotStagingDealsAction(
  tenantId: string,
  integrationId: string,
  importStatus?: string | null
): Promise<HubspotActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const [snapshotRes, dealsRes] = await Promise.all([
      loadHubspotConnectorSnapshot(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      }),
      loadHubspotStagingDeals(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
        importStatus: importStatus ?? undefined,
      }),
    ]);

    if (!snapshotRes.ok) return snapshotRes;
    if (!dealsRes.ok) return dealsRes;

    return {
      ok: true,
      snapshot: {
        ...snapshotRes.snapshot,
        dealQueue: dealsRes.deals,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load staging deals." };
  }
}
