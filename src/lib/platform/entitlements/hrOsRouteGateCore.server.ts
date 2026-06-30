import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiOsPlatformAdminFullSessionBypass, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";

import { writeEntitlementAuditEvent } from "./entitlementAudit.server";
import type { ModuleAccessDenied, ModuleAccessResult } from "./entitlementTypes";
import { canShowModuleNav, HR_OS_MODULE_CODE, HR_OS_ROUTE_REQUIRED_ROLES } from "./modules";
import { requireModuleAccess } from "./requireModuleAccess.server";
import { loadClientSafeTenantEntitlements } from "./tenantEntitlements.server";

export { HR_OS_MODULE_CODE, HR_OS_ROUTE_REQUIRED_ROLES } from "./modules";

export type HrOsRouteAccessGranted = {
  ok: true;
  fiUserId: string;
  userRole: string;
  /** Platform operator preview — entitlement checks skipped for route entry. */
  platformAdminPreview: boolean;
};

export type HrOsRouteAccessDenied = {
  ok: false;
  fiUserId: string | null;
  access: ModuleAccessDenied;
};

export type HrOsRouteAccessResult = HrOsRouteAccessGranted | HrOsRouteAccessDenied;

export type ResolveHrOsRouteAccessTestOptions = {
  supabaseClientForTests?: SupabaseClient;
  authUserId?: string | null;
  platformAdminPreview?: boolean;
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

async function writeHrOsRouteAudit(
  opts: {
    tenantId: string;
    fiUserId: string | null;
    outcome: "allowed" | "denied";
    denialReason?: ModuleAccessDenied["reason"] | null;
  },
  supabaseClientForTests?: SupabaseClient
): Promise<void> {
  await writeEntitlementAuditEvent(
    {
      tenantId: opts.tenantId,
      fiUserId: opts.fiUserId,
      moduleCode: HR_OS_MODULE_CODE,
      outcome: opts.outcome,
      denialReason: opts.outcome === "denied" ? (opts.denialReason ?? null) : null,
      source: "hr_os_route_access",
    },
    { supabaseClientForTests }
  );
}

/**
 * Server-side HR OS route gate. Writes `hr_os_route_access` audit events.
 * Platform admins may enter in preview mode without satisfying tenant entitlements.
 */
export async function resolveHrOsRouteAccessWithOptions(
  tenantId: string,
  testOptions?: ResolveHrOsRouteAccessTestOptions
): Promise<HrOsRouteAccessResult> {
  const tid = tenantId.trim();
  const supabaseClientForTests = testOptions?.supabaseClientForTests;
  const authUserId =
    testOptions && "authUserId" in testOptions
      ? (testOptions.authUserId ?? null)
      : await resolveAuthUserId(null);

  if (!authUserId) {
    const access: ModuleAccessDenied = {
      ok: false,
      reason: "user_not_found",
      message: "You do not have access to this clinic workspace.",
    };
    await writeHrOsRouteAudit(
      { tenantId: tid, fiUserId: null, outcome: "denied", denialReason: access.reason },
      supabaseClientForTests
    );
    return { ok: false, fiUserId: null, access };
  }

  const fiUser = await loadFiUserIdForSession(tid, authUserId, supabaseClientForTests);
  const platformAdminPreview =
    testOptions?.platformAdminPreview ?? (await isPlatformAdminViewer(authUserId));

  if (platformAdminPreview) {
    await writeHrOsRouteAudit(
      { tenantId: tid, fiUserId: fiUser?.id ?? null, outcome: "allowed" },
      supabaseClientForTests
    );
    return {
      ok: true,
      fiUserId: fiUser?.id ?? authUserId,
      userRole: fiUser?.role ?? "fi_platform_admin",
      platformAdminPreview: true,
    };
  }

  if (!fiUser) {
    const access: ModuleAccessDenied = {
      ok: false,
      reason: "user_not_found",
      message: "You do not have access to this clinic workspace.",
    };
    await writeHrOsRouteAudit(
      { tenantId: tid, fiUserId: null, outcome: "denied", denialReason: access.reason },
      supabaseClientForTests
    );
    return { ok: false, fiUserId: null, access };
  }

  const access: ModuleAccessResult = await requireModuleAccess({
    tenantId: tid,
    userId: fiUser.id,
    moduleCode: HR_OS_MODULE_CODE,
    requiredRoles: HR_OS_ROUTE_REQUIRED_ROLES,
    writeAudit: false,
    supabaseClientForTests,
  });

  if (!access.ok) {
    await writeHrOsRouteAudit(
      {
        tenantId: tid,
        fiUserId: fiUser.id,
        outcome: "denied",
        denialReason: access.reason,
      },
      supabaseClientForTests
    );
    return { ok: false, fiUserId: fiUser.id, access };
  }

  await writeHrOsRouteAudit(
    { tenantId: tid, fiUserId: fiUser.id, outcome: "allowed" },
    supabaseClientForTests
  );

  return {
    ok: true,
    fiUserId: fiUser.id,
    userRole: access.userRole,
    platformAdminPreview: false,
  };
}

export async function loadHrOsNavVisibleForViewerImpl(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  if (!tid) return false;

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) return false;

  if (await isPlatformAdminViewer(authUserId)) return true;

  const fiUser = await loadFiUserIdForSession(tid, authUserId);
  if (!fiUser) return false;

  const entitlements = await loadClientSafeTenantEntitlements({
    tenantId: tid,
    userId: fiUser.id,
    moduleCodes: [HR_OS_MODULE_CODE],
  });

  return canShowModuleNav(entitlements, HR_OS_MODULE_CODE);
}
