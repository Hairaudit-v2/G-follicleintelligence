"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import {
  archiveTenantForPlatformAdmin,
  auditTenantDependencies,
  restoreTenantForPlatformAdmin,
} from "@/src/lib/fiOs/platformTenantLifecycle.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";

export type FiPlatformTenantLifecycleActionResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

const archiveBodySchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
  sessionActiveTenantId: z.string().uuid().optional().nullable(),
  allowProtectedArchive: z.boolean().optional(),
});

const restoreBodySchema = z.object({
  tenantId: z.string().uuid(),
});

const dependencyBodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function archivePlatformTenantAction(
  body: unknown
): Promise<FiPlatformTenantLifecycleActionResult> {
  try {
    const parsed = archiveBodySchema.parse(body);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await archiveTenantForPlatformAdmin({
      actorAuthUserId: authId,
      tenantId: parsed.tenantId,
      reason: parsed.reason,
      sessionActiveTenantId: parsed.sessionActiveTenantId,
      allowProtectedArchive: parsed.allowProtectedArchive,
    });

    if (result.ok) {
      revalidatePath("/fi-admin/system/tenants");
      revalidatePath("/fi-admin");
    }
    return result;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function restorePlatformTenantAction(
  body: unknown
): Promise<FiPlatformTenantLifecycleActionResult> {
  try {
    const parsed = restoreBodySchema.parse(body);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };

    const result = await restoreTenantForPlatformAdmin({
      actorAuthUserId: authId,
      tenantId: parsed.tenantId,
    });

    if (result.ok) {
      revalidatePath("/fi-admin/system/tenants");
      revalidatePath("/fi-admin");
    }
    return result;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type FiTenantDependencyAuditActionResult =
  | { ok: true; audit: Awaited<ReturnType<typeof auditTenantDependencies>> }
  | { ok: false; error: string };

export async function loadTenantDependencyAuditAction(
  body: unknown
): Promise<FiTenantDependencyAuditActionResult> {
  try {
    const parsed = dependencyBodySchema.parse(body);
    const authId = await resolveAuthUserId(null);
    if (!authId) return { ok: false, error: "Authentication required." };
    const os = await loadFiOsIdentity(authId);
    if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
      return { ok: false, error: "Platform administrator access is required." };
    }

    const audit = await auditTenantDependencies(parsed.tenantId);
    return { ok: true, audit };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
