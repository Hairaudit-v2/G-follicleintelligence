"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  approveTenantGoLive,
  loadGoLiveReadinessSnapshot,
  loadGoLiveReadinessSnapshotForTenant,
  markGoLiveChecklistItemReviewed,
  markOwnerReviewComplete,
  markPlatformReviewComplete,
} from "@/src/lib/onboarding-os/goLiveReadiness.server";
import type { GoLiveReadinessSnapshot } from "@/src/lib/onboarding-os/goLiveReadinessTypes";

export type GoLiveReadinessActionResult =
  | { ok: true; snapshot?: GoLiveReadinessSnapshot }
  | { ok: false; error: string };

const sessionIdSchema = z.string().uuid();
const tenantIdSchema = z.string().uuid();
const checkCodeSchema = z.string().min(1).max(80);

function revalidateGoLivePaths(sessionId: string, tenantId?: string | null) {
  revalidatePath(`/fi-admin/platform/onboarding/${sessionId}`);
  revalidatePath("/fi-admin/platform/onboarding");
  if (tenantId) {
    revalidatePath(`/fi-admin/${tenantId}/configuration`);
  }
}

async function resolveActorAuthId(): Promise<string | null> {
  return resolveAuthUserId(null);
}

export async function loadGoLiveReadinessSnapshotAction(
  sessionId: string
): Promise<GoLiveReadinessActionResult & { snapshot?: GoLiveReadinessSnapshot }> {
  try {
    const sid = sessionIdSchema.parse(sessionId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await loadGoLiveReadinessSnapshot(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
      allowTenantMemberRead: !isPlatform,
    });
    if (!result.ok) return result;
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid session." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load readiness." };
  }
}

export async function loadTenantGoLiveReadinessAction(
  tenantId: string
): Promise<GoLiveReadinessActionResult & { snapshot?: GoLiveReadinessSnapshot }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await loadGoLiveReadinessSnapshotForTenant(tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      persistSnapshot: false,
    });
    if (!result.ok) return result;
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load readiness." };
  }
}

export async function markGoLiveChecklistItemReviewedAction(
  sessionId: string,
  checkCode: string
): Promise<GoLiveReadinessActionResult> {
  try {
    const sid = sessionIdSchema.parse(sessionId);
    const code = checkCodeSchema.parse(checkCode);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await markGoLiveChecklistItemReviewed(sid, code, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    const loaded = await loadGoLiveReadinessSnapshot(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
      allowTenantMemberRead: !isPlatform,
    });
    revalidateGoLivePaths(sid, loaded.ok ? loaded.snapshot.tenantId : null);
    return { ok: true, snapshot: loaded.ok ? loaded.snapshot : undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark checklist item." };
  }
}

export async function markOwnerReviewCompleteAction(sessionId: string): Promise<GoLiveReadinessActionResult> {
  try {
    const sid = sessionIdSchema.parse(sessionId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await markOwnerReviewComplete(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    const loaded = await loadGoLiveReadinessSnapshot(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
      allowTenantMemberRead: !isPlatform,
    });
    revalidateGoLivePaths(sid, loaded.ok ? loaded.snapshot.tenantId : null);
    return { ok: true, snapshot: loaded.ok ? loaded.snapshot : undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid session." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark owner review." };
  }
}

export async function markPlatformReviewCompleteAction(sessionId: string): Promise<GoLiveReadinessActionResult> {
  try {
    const sid = sessionIdSchema.parse(sessionId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
      return { ok: false, error: "Platform administrator access is required." };
    }

    const result = await markPlatformReviewComplete(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;

    const loaded = await loadGoLiveReadinessSnapshot(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    revalidateGoLivePaths(sid, loaded.ok ? loaded.snapshot.tenantId : null);
    return { ok: true, snapshot: loaded.ok ? loaded.snapshot : undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid session." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark platform review." };
  }
}

export async function approveTenantGoLiveAction(sessionId: string): Promise<GoLiveReadinessActionResult> {
  try {
    const sid = sessionIdSchema.parse(sessionId);
    const authId = await resolveActorAuthId();
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
      return { ok: false, error: "Platform administrator access is required to approve go-live." };
    }

    const result = await approveTenantGoLive(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;

    revalidateGoLivePaths(sid, result.snapshot.tenantId);
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid session." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to approve go-live." };
  }
}
