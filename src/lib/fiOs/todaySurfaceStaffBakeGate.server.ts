import "server-only";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsElevatedOsOperatorRole, isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { logStructured } from "@/src/lib/server/structuredLog";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Temporary D6 bake safety gate — restricts Today surface to platform/founder/admin
 * viewers until staff identity/onboarding is validated for broader UAT.
 *
 * Env allowlists (optional):
 * - `FI_TODAY_SURFACE_USER_EMAILS=email@example.com,other@example.com`
 * - `FI_TODAY_SURFACE_USER_IDS=uuid,uuid`
 *
 * Fail closed: unknown or normal staff viewers fall back to the legacy home surface.
 */

function normalizeAllowlistToken(raw: string): string {
  return raw.trim().toLowerCase();
}

function parseAllowlist(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => normalizeAllowlistToken(s))
      .filter(Boolean)
  );
}

export type TodaySurfaceStaffBakeGateInput = {
  authUserId: string | null;
  userEmail?: string | null;
  osRole?: string | null;
  fiUserRole?: string | null;
  hasActiveTenantAdminProfile?: boolean;
};

const TENANT_ADMIN_FI_USER_ROLES = new Set(["owner", "fi_admin", "admin"]);

/** Pure evaluator — safe for unit tests. */
export function isTodaySurfaceStaffBakeAllowed(input: TodaySurfaceStaffBakeGateInput): boolean {
  const authUserId = input.authUserId?.trim();
  if (!authUserId) return false;

  const emailAllowlist = parseAllowlist(process.env.FI_TODAY_SURFACE_USER_EMAILS);
  const idAllowlist = parseAllowlist(process.env.FI_TODAY_SURFACE_USER_IDS);

  if (idAllowlist.has(authUserId.toLowerCase())) return true;

  const email = input.userEmail?.trim().toLowerCase();
  if (email && emailAllowlist.has(email)) return true;

  if (isFiOsPlatformAdminRole(input.osRole)) return true;
  if (isFiOsElevatedOsOperatorRole(input.osRole)) return true;

  const fiUserRole = String(input.fiUserRole ?? "")
    .trim()
    .toLowerCase();
  if (TENANT_ADMIN_FI_USER_ROLES.has(fiUserRole)) return true;

  if (input.hasActiveTenantAdminProfile) return true;

  return false;
}

async function loadViewerEmailForBakeGate(
  tenantId: string,
  authUserId: string
): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("email")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const email = (data as { email: string | null }).email;
  return email?.trim() || null;
}

/** Loads session identity and evaluates the D6 staff bake gate for the tenant home page. */
export async function resolveTodaySurfaceStaffBakeAccess(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  const authUserId = await resolveAuthUserId(null);

  if (!authUserId) {
    logStructured("info", "fi_today_surface_staff_bake_gate_evaluated", {
      tenant_id: tid,
      allowed: false,
      reason: "no_auth_user",
    });
    return false;
  }

  const [os, userEmail, tenantAdmin] = await Promise.all([
    loadFiOsIdentity(authUserId),
    loadViewerEmailForBakeGate(tid, authUserId),
    loadActiveTenantAdminProfileForSession(tid, authUserId),
  ]);

  let fiUserRole: string | null = null;
  if (tenantAdmin) {
    fiUserRole = "admin";
  } else {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("fi_users")
      .select("role")
      .eq("tenant_id", tid)
      .eq("auth_user_id", authUserId.trim())
      .maybeSingle();
    fiUserRole = data ? String((data as { role: string | null }).role ?? "") : null;
  }

  const allowed = isTodaySurfaceStaffBakeAllowed({
    authUserId,
    userEmail,
    osRole: os?.osRole ?? null,
    fiUserRole,
    hasActiveTenantAdminProfile: tenantAdmin != null,
  });

  logStructured("info", "fi_today_surface_staff_bake_gate_evaluated", {
    tenant_id: tid,
    allowed,
    reason: allowed ? "passed" : "staff_viewer_blocked",
  });

  return allowed;
}
