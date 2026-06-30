"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  approveExternalCalendarEvent,
  loadCalendarSyncRuns,
  loadExternalCalendarStagingEvents,
  loadGoogleCalendarConnectorSnapshot,
  rejectExternalCalendarEvent,
  runGoogleCalendarSync,
} from "@/src/lib/onboarding-os/googleCalendarConnector.server";
import type { GoogleCalendarConnectorSnapshot } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

export type GoogleCalendarActionResult =
  | { ok: true; snapshot?: GoogleCalendarConnectorSnapshot }
  | { ok: false; error: string };

const tenantIdSchema = z.string().uuid();
const integrationIdSchema = z.string().uuid();
const stagingEventIdSchema = z.string().uuid();

function revalidateCalendarPaths(tenantId: string, sessionId?: string | null) {
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
): Promise<GoogleCalendarConnectorSnapshot | undefined> {
  const loaded = await loadGoogleCalendarConnectorSnapshot(integrationId, tenantId, {
    actorAuthUserId: authId,
    allowTenantMemberRead: true,
    skipAuthCheck: isPlatform,
  });
  return loaded.ok ? loaded.snapshot : undefined;
}

export async function loadGoogleCalendarConnectorSnapshotAction(
  tenantId: string,
  integrationId: string
): Promise<GoogleCalendarActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await loadGoogleCalendarConnectorSnapshot(iid, tid, {
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
      error: e instanceof Error ? e.message : "Failed to load calendar connector.",
    };
  }
}

export async function runGoogleCalendarSyncAction(
  tenantId: string,
  integrationId: string,
  sessionId?: string | null
): Promise<GoogleCalendarActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await runGoogleCalendarSync(iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateCalendarPaths(tid, sessionId);
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Calendar sync failed." };
  }
}

export async function approveExternalCalendarEventAction(
  tenantId: string,
  integrationId: string,
  stagingEventId: string,
  sessionId?: string | null
): Promise<GoogleCalendarActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingEventIdSchema.parse(stagingEventId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await approveExternalCalendarEvent(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateCalendarPaths(tid, sessionId);
    const snapshot = await loadSnapshotForIntegration(iid, tid, authId, isPlatform);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve event." };
  }
}

export async function rejectExternalCalendarEventAction(
  tenantId: string,
  integrationId: string,
  stagingEventId: string,
  sessionId?: string | null
): Promise<GoogleCalendarActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);
    const sid = stagingEventIdSchema.parse(stagingEventId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await rejectExternalCalendarEvent(sid, iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateCalendarPaths(tid, sessionId);
    const snapshot = await loadSnapshotForIntegration(iid, tid, authId, isPlatform);
    return { ok: true, snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reject event." };
  }
}

export async function loadExternalCalendarStagingEventsAction(
  tenantId: string,
  integrationId: string,
  importStatus?: string | null
): Promise<GoogleCalendarActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const [snapshotRes, stagingRes] = await Promise.all([
      loadGoogleCalendarConnectorSnapshot(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      }),
      loadExternalCalendarStagingEvents(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
        importStatus: importStatus ?? undefined,
      }),
    ]);

    if (!snapshotRes.ok) return snapshotRes;
    if (!stagingRes.ok) return stagingRes;

    return {
      ok: true,
      snapshot: {
        ...snapshotRes.snapshot,
        stagingQueue: stagingRes.events,
      },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load staging events." };
  }
}

export async function loadCalendarSyncRunsAction(
  tenantId: string,
  integrationId: string
): Promise<GoogleCalendarActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const [snapshotRes, runsRes] = await Promise.all([
      loadGoogleCalendarConnectorSnapshot(iid, tid, {
        actorAuthUserId: authId,
        allowTenantMemberRead: true,
        skipAuthCheck: isPlatform,
      }),
      loadCalendarSyncRuns(iid, tid, {
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
