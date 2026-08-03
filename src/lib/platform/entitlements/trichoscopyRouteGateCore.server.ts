import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiOsPlatformAdminFullSessionBypass, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import {
  HLI_TRICHOSCOPY_MODULE_CODE,
  HLI_TRICHOSCOPY_SETTINGS_REQUIRED_ROLES,
} from "@/src/lib/platform/entitlements/modules";
import { writeModuleLifecycleAudit } from "@/src/lib/platform/entitlements/moduleLifecycleAudit.server";
import {
  isHliTrichoscopyPlatformEnabled,
  resolveFiosTrichoscopyAccess,
} from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";
import type { FiosTrichoscopyAccessDenialReason } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

export type TrichoscopyRouteAccessGranted = {
  ok: true;
  fiUserId: string;
  userRole: string;
  platformAdminPreview: boolean;
  historicalReadOnly: boolean;
};

export type TrichoscopyRouteAccessDenied = {
  ok: false;
  fiUserId: string | null;
  reason: FiosTrichoscopyAccessDenialReason | "user_not_found";
  message: string;
};

export type TrichoscopyRouteAccessResult =
  | TrichoscopyRouteAccessGranted
  | TrichoscopyRouteAccessDenied;

export type ResolveTrichoscopyRouteAccessTestOptions = {
  supabaseClientForTests?: SupabaseClient;
  authUserId?: string | null;
  platformAdminPreview?: boolean;
  env?: NodeJS.ProcessEnv;
};

async function loadFiUserIdForSession(
  tenantId: string,
  authUserId: string,
  supabaseClientForTests?: SupabaseClient
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String((data as { id: string }).id),
    role: String((data as { role: string | null }).role ?? "member"),
  };
}

async function isPlatformAdminViewer(authUserId: string): Promise<boolean> {
  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) return true;
  const os = await loadFiOsIdentity(authUserId);
  return Boolean(os && isFiOsPlatformAdminRole(os.osRole));
}

/**
 * Server-side trichoscopy route gate. Platform admins may preview without entitlement.
 */
export async function resolveTrichoscopyRouteAccessWithOptions(
  tenantId: string,
  testOptions?: ResolveTrichoscopyRouteAccessTestOptions
): Promise<TrichoscopyRouteAccessResult> {
  const tid = tenantId.trim();
  const env = testOptions?.env ?? process.env;

  if (!isHliTrichoscopyPlatformEnabled(env)) {
    return {
      ok: false,
      fiUserId: null,
      reason: "platform_disabled",
      message: "Trichoscopy Intelligence is temporarily unavailable.",
    };
  }

  const authUserId =
    testOptions && "authUserId" in testOptions
      ? (testOptions.authUserId ?? null)
      : await resolveAuthUserId(null);

  if (!authUserId) {
    return {
      ok: false,
      fiUserId: null,
      reason: "user_not_found",
      message: "You do not have access to this clinic workspace.",
    };
  }

  const fiUser = await loadFiUserIdForSession(tid, authUserId, testOptions?.supabaseClientForTests);
  const platformAdminPreview =
    testOptions?.platformAdminPreview === true || (await isPlatformAdminViewer(authUserId));

  if (platformAdminPreview) {
    await writeModuleLifecycleAudit({
      tenantId: tid,
      eventType: "access_granted",
      actorUserId: fiUser?.id ?? null,
      source: "trichoscopy_route_access",
      newState: { platform_admin_preview: true },
      supabaseClientForTests: testOptions?.supabaseClientForTests,
    });
    return {
      ok: true,
      fiUserId: fiUser?.id ?? authUserId,
      userRole: fiUser?.role ?? "fi_platform_admin",
      platformAdminPreview: true,
      historicalReadOnly: false,
    };
  }

  if (!fiUser) {
    return {
      ok: false,
      fiUserId: null,
      reason: "user_not_found",
      message: "You do not have access to this clinic workspace.",
    };
  }

  const access = await resolveFiosTrichoscopyAccess({
    tenantId: tid,
    userId: fiUser.id,
    capability: "trichoscopy.view",
    supabaseClientForTests: testOptions?.supabaseClientForTests,
    env,
  });

  if (access.allowed || (access.historicalReadOnly && access.capabilityIncluded && access.userPermitted)) {
    return {
      ok: true,
      fiUserId: fiUser.id,
      userRole: fiUser.role,
      platformAdminPreview: false,
      historicalReadOnly: Boolean(access.historicalReadOnly && !access.allowed),
    };
  }

  return {
    ok: false,
    fiUserId: fiUser.id,
    reason: access.denialReason ?? "entitlement_inactive",
    message:
      access.denialReason === "subscription_not_included"
        ? "Trichoscopy Intelligence is not included in your current subscription."
        : access.denialReason === "tenant_module_disabled"
          ? "Trichoscopy Intelligence is included but not yet activated."
          : "You do not have access to Trichoscopy Intelligence.",
  };
}

export async function loadTrichoscopyNavVisibleForViewerImpl(tenantId: string): Promise<boolean> {
  const access = await resolveTrichoscopyRouteAccessWithOptions(tenantId);
  return access.ok && !access.historicalReadOnly;
}

export async function canManageTrichoscopyModuleSettings(opts: {
  tenantId: string;
  userId: string;
  userRole: string;
}): Promise<boolean> {
  const role = opts.userRole.trim().toLowerCase();
  if (!(HLI_TRICHOSCOPY_SETTINGS_REQUIRED_ROLES as readonly string[]).includes(role)) {
    return false;
  }
  const access = await resolveFiosTrichoscopyAccess({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: "trichoscopy.view",
    bypassUserPermission: true,
  });
  // Admins may see locked / activation states even when not entitled
  return (
    access.platformEnabled &&
    (access.tenantEntitled ||
      access.entitlementStatus === "not_entitled" ||
      access.entitlementStatus === "grace_period" ||
      access.entitlementStatus === "expired" ||
      access.entitlementStatus === "cancelled" ||
      Boolean(access.denialReason === "tenant_module_disabled" || access.denialReason === "subscription_not_included"))
  );
}

export { HLI_TRICHOSCOPY_MODULE_CODE };
