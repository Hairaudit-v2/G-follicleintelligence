"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  loadDeploymentIntelligenceSnapshot,
  loadDeploymentIntelligenceSnapshotForTenant,
} from "@/src/lib/onboarding-os/deploymentIntelligence.server";
import type { DeploymentIntelligenceSnapshot } from "@/src/lib/onboarding-os/deploymentIntelligenceTypes";

export type DeploymentIntelligenceActionResult =
  | { ok: true; snapshot?: DeploymentIntelligenceSnapshot }
  | { ok: false; error: string };

const sessionIdSchema = z.string().uuid();
const tenantIdSchema = z.string().uuid();

export async function loadTenantDeploymentIntelligenceAction(
  tenantId: string
): Promise<DeploymentIntelligenceActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await loadDeploymentIntelligenceSnapshotForTenant(tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      persistSnapshot: false,
    });
    if (!result.ok) return result;
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load deployment intelligence." };
  }
}

export async function loadSessionDeploymentIntelligenceAction(
  sessionId: string
): Promise<DeploymentIntelligenceActionResult> {
  try {
    const sid = sessionIdSchema.parse(sessionId);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await loadDeploymentIntelligenceSnapshot(sid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
      allowTenantMemberRead: !isPlatform,
    });
    if (!result.ok) return result;
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid session." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load deployment intelligence." };
  }
}

export async function revalidateDeploymentIntelligencePaths(sessionId: string, tenantId?: string | null) {
  revalidatePath("/fi-admin/platform/deployments");
  revalidatePath(`/fi-admin/platform/onboarding/${sessionId}`);
  if (tenantId) revalidatePath(`/fi-admin/${tenantId}/configuration`);
}
