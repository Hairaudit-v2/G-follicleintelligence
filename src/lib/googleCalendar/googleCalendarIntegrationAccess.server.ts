import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export type GoogleCalendarIntegrationAccessOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  request?: Request | null;
};

export class GoogleCalendarIntegrationAccessError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GoogleCalendarIntegrationAccessError";
  }
}

async function resolvePlatformAdminAuth(
  opts: GoogleCalendarIntegrationAccessOpts
): Promise<{ ok: true; actorAuthUserId: string } | { ok: false; error: string }> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(opts.request ?? null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
}

/** Require clinic_admin / operations_admin (or platform admin) for Google Calendar integration mutations. */
export async function assertGoogleCalendarTenantAdminAccess(
  tenantId: string,
  opts: GoogleCalendarIntegrationAccessOpts = {}
): Promise<{ actorAuthUserId: string }> {
  const tid = tenantId.trim();
  if (!tid) throw new GoogleCalendarIntegrationAccessError(400, "Tenant id is required.");

  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { actorAuthUserId: opts.actorAuthUserId };
  }

  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(opts.request ?? null));
  if (!authId) throw new GoogleCalendarIntegrationAccessError(401, "Authentication required.");

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { actorAuthUserId: authId };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) {
    throw new GoogleCalendarIntegrationAccessError(403, "Tenant membership required.");
  }

  const adminProf = await loadActiveTenantAdminProfileForSession(tid, authId);
  if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
    const platform = await resolvePlatformAdminAuth({ ...opts, actorAuthUserId: authId });
    if (!platform.ok) {
      throw new GoogleCalendarIntegrationAccessError(403, "Tenant admin access is required.");
    }
    return { actorAuthUserId: authId };
  }

  return { actorAuthUserId: authId };
}
