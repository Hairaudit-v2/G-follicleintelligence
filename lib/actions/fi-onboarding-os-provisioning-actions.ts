"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import {
  createTenantProvisioningSession,
  applySandboxSeedToTenant,
  finalizeTenantProvisioning,
  loadSandboxSeedPreview,
  markProvisioningReadyForReview,
  retryTenantProvisioningStep,
  runTenantProvisioningStep,
} from "@/src/lib/onboarding-os/tenantProvisioning.server";
import type { SandboxSeedPackCode } from "@/src/lib/onboarding-os/tenantProvisioningTypes";

const createSessionSchema = z.object({
  tenantName: z.string().min(1).max(200),
  tenantSlug: z.string().min(1).max(80),
  defaultClinicDisplayName: z.string().min(1).max(200),
  defaultTimezone: z.string().min(1).max(120),
  firstTenantAdminEmail: z.string().email(),
  supportEmail: z.string().email().optional().nullable(),
  templateCode: z.string().optional().nullable(),
  deploymentTemplateCode: z.string().optional().nullable(),
  enabledModuleCodes: z.array(z.string()).optional().nullable(),
  sandboxSeedEnabled: z.boolean().optional().nullable(),
});

export type OnboardingOsActionResult =
  | { ok: true; sessionId?: string; tenantId?: string | null }
  | { ok: false; error: string };

async function assertPlatformAdmin(): Promise<
  { ok: true; authId: string } | { ok: false; error: string }
> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return { ok: false, error: "Authentication required." };
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, authId };
}

function revalidateOnboardingPaths(sessionId?: string) {
  revalidatePath("/fi-admin/platform/onboarding");
  if (sessionId) revalidatePath(`/fi-admin/platform/onboarding/${sessionId}`);
}

export async function createOnboardingSessionAction(
  body: unknown
): Promise<OnboardingOsActionResult> {
  try {
    const auth = await assertPlatformAdmin();
    if (!auth.ok) return auth;

    const parsed = createSessionSchema.parse(body);
    const result = await createTenantProvisioningSession(
      {
        tenantName: parsed.tenantName.trim(),
        tenantSlug: parsed.tenantSlug.trim().toLowerCase(),
        defaultClinicDisplayName: parsed.defaultClinicDisplayName.trim(),
        defaultTimezone: parsed.defaultTimezone.trim(),
        firstTenantAdminEmail: parsed.firstTenantAdminEmail.trim(),
        supportEmail: parsed.supportEmail?.trim() || null,
        templateCode: parsed.templateCode?.trim() || null,
        deploymentTemplateCode: parsed.deploymentTemplateCode?.trim() || null,
        enabledModuleCodes: parsed.enabledModuleCodes ?? null,
        sandboxSeedEnabled: parsed.sandboxSeedEnabled ?? null,
      },
      { actorAuthUserId: auth.authId, skipAuthCheck: true }
    );

    if (!result.ok) return result;
    revalidateOnboardingPaths(result.sessionId);
    return { ok: true, sessionId: result.sessionId };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runOnboardingStepAction(
  sessionId: string,
  stepCode: string
): Promise<OnboardingOsActionResult> {
  const auth = await assertPlatformAdmin();
  if (!auth.ok) return auth;

  const result = await runTenantProvisioningStep(sessionId, stepCode, {
    actorAuthUserId: auth.authId,
    skipAuthCheck: true,
  });
  if (!result.ok) return result;
  revalidateOnboardingPaths(sessionId);
  return { ok: true, sessionId };
}

export async function retryOnboardingStepAction(
  sessionId: string,
  stepCode: string
): Promise<OnboardingOsActionResult> {
  const auth = await assertPlatformAdmin();
  if (!auth.ok) return auth;

  const result = await retryTenantProvisioningStep(sessionId, stepCode, {
    actorAuthUserId: auth.authId,
    skipAuthCheck: true,
  });
  if (!result.ok) return result;
  revalidateOnboardingPaths(sessionId);
  return { ok: true, sessionId };
}

export async function markOnboardingReadyForReviewAction(
  sessionId: string
): Promise<OnboardingOsActionResult> {
  const auth = await assertPlatformAdmin();
  if (!auth.ok) return auth;

  const result = await markProvisioningReadyForReview(sessionId, {
    actorAuthUserId: auth.authId,
    skipAuthCheck: true,
  });
  if (!result.ok) return result;
  revalidateOnboardingPaths(sessionId);
  return { ok: true, sessionId };
}

export async function finalizeOnboardingSessionAction(
  sessionId: string
): Promise<OnboardingOsActionResult> {
  const auth = await assertPlatformAdmin();
  if (!auth.ok) return auth;

  const result = await finalizeTenantProvisioning(sessionId, {
    actorAuthUserId: auth.authId,
    skipAuthCheck: true,
  });
  if (!result.ok) return result;
  revalidateOnboardingPaths(sessionId);
  return { ok: true, sessionId, tenantId: result.tenantId };
}

export async function runAllOnboardingStepsAction(
  sessionId: string
): Promise<OnboardingOsActionResult> {
  const auth = await assertPlatformAdmin();
  if (!auth.ok) return auth;

  const stepCodes = [
    "validate_input",
    "check_slug_availability",
    "provision_tenant_core",
    "apply_module_entitlements",
    "apply_verification_status",
    "deploy_clinic_configuration",
    "assign_academy_training",
    "prepare_sandbox_seed",
  ] as const;

  for (const stepCode of stepCodes) {
    const result = await runTenantProvisioningStep(sessionId, stepCode, {
      actorAuthUserId: auth.authId,
      skipAuthCheck: true,
    });
    if (!result.ok) return result;
  }

  revalidateOnboardingPaths(sessionId);
  return { ok: true, sessionId };
}

const applySandboxSeedSchema = z.object({
  sessionId: z.string().min(1),
  packCode: z.enum(["light_demo", "standard_demo", "enterprise_demo"]).optional().nullable(),
  force: z.boolean().optional(),
});

export async function loadSandboxSeedPreviewAction(
  sessionId: string,
  packCode?: SandboxSeedPackCode | null
): Promise<
  | {
      ok: true;
      preview: import("@/src/lib/onboarding-os/tenantProvisioningTypes").SandboxSeedPreview;
      history: import("@/src/lib/onboarding-os/tenantProvisioningTypes").SandboxSeedHistoryEntry[];
    }
  | { ok: false; error: string }
> {
  const auth = await assertPlatformAdmin();
  if (!auth.ok) return auth;

  const result = await loadSandboxSeedPreview(sessionId, {
    packCode: packCode ?? null,
    actorAuthUserId: auth.authId,
    skipAuthCheck: true,
  });
  if (!result.ok) return result;
  return { ok: true, preview: result.preview, history: result.history };
}

export async function applySandboxSeedAction(body: unknown): Promise<OnboardingOsActionResult> {
  try {
    const auth = await assertPlatformAdmin();
    if (!auth.ok) return auth;

    const parsed = applySandboxSeedSchema.parse(body);
    const result = await applySandboxSeedToTenant(
      {
        sessionId: parsed.sessionId.trim(),
        packCode: parsed.packCode ?? null,
        force: parsed.force ?? false,
      },
      { actorAuthUserId: auth.authId, skipAuthCheck: true }
    );

    if (!result.ok) return { ok: false, error: result.error };
    revalidateOnboardingPaths(parsed.sessionId.trim());
    return { ok: true, sessionId: parsed.sessionId.trim() };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
