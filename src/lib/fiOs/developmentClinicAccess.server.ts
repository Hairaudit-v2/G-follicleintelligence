import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isFiOsPlatformAdminFullSessionBypass,
  loadProxyFiUserRowForPlatformAdminTenant,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import {
  canUseDevelopmentClinicFeatures,
  isConfiguredDevelopmentAdminAuthUser,
} from "@/src/lib/fiOs/developmentClinicAccess";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

export type DevelopmentClinicAccessResult = {
  allowed: boolean;
  blockedReason: string | null;
  authUserId: string | null;
  fiUserId: string | null;
  fiUserRole: string | null;
  tenantAdminRole: FiTenantAdminRole | null;
  fiOsRole: string | null;
};

async function resolvePrincipalAuthUserId(sessionAuthUserId: string): Promise<string> {
  const imp = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return imp ?? sessionAuthUserId;
}

async function loadFiUserForTenant(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
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

const BLOCKED_UNAUTHENTICATED =
  "Sign in to use ClinicOS scheduling and booking tools. The calendar is view-only until you are authenticated.";

/**
 * Server resolver for development-phase ClinicOS operational access.
 * Used by calendar mutation gates, dashboard quick actions, and aligned UI flags.
 */
export async function resolveDevelopmentClinicAccessForTenant(
  tenantId: string,
  sessionAuthUserId?: string | null
): Promise<DevelopmentClinicAccessResult> {
  const tid = tenantId.trim();
  const empty: DevelopmentClinicAccessResult = {
    allowed: false,
    blockedReason: BLOCKED_UNAUTHENTICATED,
    authUserId: null,
    fiUserId: null,
    fiUserRole: null,
    tenantAdminRole: null,
    fiOsRole: null,
  };

  const authUserId = sessionAuthUserId?.trim() || (await resolveAuthUserId(null));
  if (!authUserId) return empty;

  const os = await loadFiOsIdentity(authUserId);
  const fiOsRole = os?.osRole ?? null;
  const isDevAdmin = isConfiguredDevelopmentAdminAuthUser(authUserId);

  if (isDevAdmin) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authUserId);
    return {
      allowed: true,
      blockedReason: null,
      authUserId,
      fiUserId: proxy?.id ?? null,
      fiUserRole: proxy?.role ?? "fi_admin",
      tenantAdminRole: null,
      fiOsRole,
    };
  }

  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) {
    const proxy = await loadProxyFiUserRowForPlatformAdminTenant(tid, authUserId);
    return {
      allowed: true,
      blockedReason: null,
      authUserId,
      fiUserId: proxy?.id ?? null,
      fiUserRole: proxy?.role ?? "fi_admin",
      tenantAdminRole: null,
      fiOsRole,
    };
  }

  const principal = await resolvePrincipalAuthUserId(authUserId);
  const fiUser = await loadFiUserForTenant(tid, principal);
  const tenantAdmin = await loadActiveTenantAdminProfileForSession(tid, authUserId);
  const tenantAdminRole = tenantAdmin?.adminRole ?? null;

  const allowed = canUseDevelopmentClinicFeatures({
    isAuthenticated: true,
    fiUserRole: fiUser?.role ?? null,
    fiOsRole,
    tenantAdminRole,
    isConfiguredDevelopmentAdmin: false,
  });

  if (!fiUser && !allowed) {
    return {
      allowed: false,
      blockedReason: "You are not a member of this tenant, so ClinicOS tools are read-only.",
      authUserId,
      fiUserId: null,
      fiUserRole: null,
      tenantAdminRole,
      fiOsRole,
    };
  }

  if (!allowed) {
    return {
      allowed: false,
      blockedReason:
        "Your role can view ClinicOS but not create or move bookings yet. Ask a tenant admin to grant admin, fi_admin, crm_operator, or operations access.",
      authUserId,
      fiUserId: fiUser?.id ?? null,
      fiUserRole: fiUser?.role ?? null,
      tenantAdminRole,
      fiOsRole,
    };
  }

  return {
    allowed: true,
    blockedReason: null,
    authUserId,
    fiUserId: fiUser?.id ?? null,
    fiUserRole: fiUser?.role ?? null,
    tenantAdminRole,
    fiOsRole,
  };
}

/** Convenience boolean for loaders and pages. */
export async function canUseDevelopmentClinicFeaturesForTenant(tenantId: string): Promise<boolean> {
  const r = await resolveDevelopmentClinicAccessForTenant(tenantId);
  return r.allowed;
}
