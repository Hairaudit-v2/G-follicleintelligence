"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  createConnectorAuthSession,
  loadConnectorAuthSummary,
  revokeConnectorAuthSession,
  verifyConnectorCredentials,
} from "@/src/lib/onboarding-os/externalConnectorAuth.server";
import type {
  ExternalConnectorAuthInput,
  ExternalConnectorAuthMethod,
  TenantConnectorAuthSnapshot,
} from "@/src/lib/onboarding-os/externalConnectorAuthTypes";
import { isExternalConnectorAuthMethod } from "@/src/lib/onboarding-os/externalConnectorAuthTypes";

export type ConnectorAuthActionResult =
  | { ok: true; authSnapshot?: TenantConnectorAuthSnapshot }
  | { ok: false; error: string };

const tenantIdSchema = z.string().uuid();
const integrationIdSchema = z.string().uuid();

function revalidateConnectorPaths(tenantId: string, sessionId?: string | null) {
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  if (sessionId) {
    revalidatePath(`/fi-admin/platform/onboarding/${sessionId}`);
  }
  revalidatePath("/fi-admin/platform/onboarding");
}

async function loadAuthSnapshotForTenant(
  tenantId: string,
  authId: string,
  isPlatform: boolean
): Promise<TenantConnectorAuthSnapshot | undefined> {
  const loaded = await loadConnectorAuthSummary(tenantId, {
    actorAuthUserId: authId,
    allowTenantMemberRead: true,
    skipAuthCheck: isPlatform,
  });
  return loaded.ok ? loaded.snapshot : undefined;
}

export async function loadConnectorAuthSummaryAction(
  tenantId: string
): Promise<ConnectorAuthActionResult & { authSnapshot?: TenantConnectorAuthSnapshot }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await loadConnectorAuthSummary(tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;
    return { ok: true, authSnapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load connector auth." };
  }
}

export async function createConnectorAuthSessionAction(
  tenantId: string,
  integrationId: string,
  authMethod?: ExternalConnectorAuthMethod | null,
  sessionId?: string | null
): Promise<ConnectorAuthActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    if (authMethod && !isExternalConnectorAuthMethod(authMethod)) {
      return { ok: false, error: "Invalid auth method." };
    }

    const result = await createConnectorAuthSession(iid, tid, authMethod, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateConnectorPaths(tid, sessionId);
    const authSnapshot = await loadAuthSnapshotForTenant(tid, authId, isPlatform);
    return { ok: true, authSnapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create auth session." };
  }
}

export async function verifyConnectorCredentialsAction(
  tenantId: string,
  integrationId: string,
  input: ExternalConnectorAuthInput,
  sessionId?: string | null
): Promise<ConnectorAuthActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    if (!isExternalConnectorAuthMethod(input.authMethod)) {
      return { ok: false, error: "Invalid auth method." };
    }

    const result = await verifyConnectorCredentials(iid, tid, input, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateConnectorPaths(tid, sessionId);
    const authSnapshot = await loadAuthSnapshotForTenant(tid, authId, isPlatform);
    return { ok: true, authSnapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Verification failed." };
  }
}

export async function revokeConnectorAuthSessionAction(
  tenantId: string,
  integrationId: string,
  sessionId?: string | null
): Promise<ConnectorAuthActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await revokeConnectorAuthSession(iid, tid, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateConnectorPaths(tid, sessionId);
    const authSnapshot = await loadAuthSnapshotForTenant(tid, authId, isPlatform);
    return { ok: true, authSnapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to revoke auth session." };
  }
}
