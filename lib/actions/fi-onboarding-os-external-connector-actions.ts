"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  createExternalConnector,
  loadTenantExternalConnectors,
  updateExternalConnector,
} from "@/src/lib/onboarding-os/externalConnector.server";
import type {
  ExternalConnectorConfigurationInput,
  ExternalConnectorProvider,
  ExternalConnectorStatus,
  TenantExternalConnectorsSnapshot,
} from "@/src/lib/onboarding-os/externalConnectorTypes";
import { isExternalConnectorProvider } from "@/src/lib/onboarding-os/externalConnectorTypes";

export type ExternalConnectorActionResult =
  | { ok: true; snapshot?: TenantExternalConnectorsSnapshot }
  | { ok: false; error: string };

const tenantIdSchema = z.string().uuid();
const integrationIdSchema = z.string().uuid();
const providerSchema = z.string().min(1).max(64);

function revalidateConnectorPaths(tenantId: string, sessionId?: string | null) {
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  if (sessionId) {
    revalidatePath(`/fi-admin/platform/onboarding/${sessionId}`);
  }
  revalidatePath("/fi-admin/platform/onboarding");
}

export async function loadTenantExternalConnectorsAction(
  tenantId: string
): Promise<ExternalConnectorActionResult & { snapshot?: TenantExternalConnectorsSnapshot }> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await loadTenantExternalConnectors(tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: !isPlatform,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;
    return { ok: true, snapshot: result.snapshot };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid tenant." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load connectors." };
  }
}

export async function createExternalConnectorAction(
  tenantId: string,
  input: ExternalConnectorConfigurationInput,
  sessionId?: string | null
): Promise<ExternalConnectorActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const provider = providerSchema.parse(input.provider);
    if (!isExternalConnectorProvider(provider)) {
      return { ok: false, error: "Unknown connector provider." };
    }

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await createExternalConnector(
      tid,
      { ...input, provider: provider as ExternalConnectorProvider },
      { actorAuthUserId: authId, skipAuthCheck: isPlatform }
    );
    if (!result.ok) return result;

    revalidateConnectorPaths(tid, sessionId);
    const loaded = await loadTenantExternalConnectors(tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      skipAuthCheck: isPlatform,
    });
    return { ok: true, snapshot: loaded.ok ? loaded.snapshot : undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create connector." };
  }
}

export async function updateExternalConnectorAction(
  tenantId: string,
  integrationId: string,
  input: Partial<ExternalConnectorConfigurationInput> & { status?: ExternalConnectorStatus },
  sessionId?: string | null
): Promise<ExternalConnectorActionResult> {
  try {
    const tid = tenantIdSchema.parse(tenantId);
    const iid = integrationIdSchema.parse(integrationId);

    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const os = await loadFiOsIdentity(authId);
    const isPlatform = isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole);

    const result = await updateExternalConnector(iid, tid, input, {
      actorAuthUserId: authId,
      skipAuthCheck: isPlatform,
    });
    if (!result.ok) return result;

    revalidateConnectorPaths(tid, sessionId);
    const loaded = await loadTenantExternalConnectors(tid, {
      actorAuthUserId: authId,
      allowTenantMemberRead: true,
      skipAuthCheck: isPlatform,
    });
    return { ok: true, snapshot: loaded.ok ? loaded.snapshot : undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input." };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update connector." };
  }
}
