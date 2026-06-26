import "server-only";

import { redirect } from "next/navigation";

import { moduleSatisfies } from "./staffAccessCore";
import { getStaffEffectiveAccess } from "./staffAccess.server";
import type { StaffAccessLevel, StaffAccessModuleKey } from "./staffAccessRegistry";

/**
 * SA-1 route/action guards.
 *
 * These run AFTER the existing FI portal/membership gates (e.g. `assertFiTenantPortalAccess`,
 * `getCrmShellPageSession`). They add the SA-1 entitlements check on top:
 *
 *   - Admin override (tenant clinic_admin / platform admin) → always allowed.
 *   - When the viewer resolves to a real staff member (an `fi_staff` row) with a mapped role,
 *     SA-1 is authoritative: effective access below the required level → denied.
 *   - When the viewer is a backend/admin session with no `fi_staff` mapping, or no principal
 *     resolves at all, the guard defers to the upstream gate — this keeps the rollout
 *     non-destructive / progressive (existing tenant-admin access is untouched).
 */

export type StaffModuleAccessDecision = {
  allowed: boolean;
  /** True when the engine had a resolved principal and made a positive deny/allow decision. */
  enforced: boolean;
  level: StaffAccessLevel | null;
};

export async function evaluateStaffModuleAccess(
  tenantId: string,
  module: StaffAccessModuleKey,
  required: StaffAccessLevel = "read"
): Promise<StaffModuleAccessDecision> {
  const { principal, access } = await getStaffEffectiveAccess(tenantId);
  if (!principal) {
    // No mappable principal — let the upstream gate remain authoritative.
    return { allowed: true, enforced: false, level: null };
  }
  if (principal.isAdminOverride) {
    return { allowed: true, enforced: true, level: "admin" };
  }
  // Only enforce for real staff members with a mapped role; backend/admin sessions without an
  // fi_staff row keep their existing tenant-admin gates (progressive, non-destructive rollout).
  if (!principal.staffMemberId || !principal.roleKey) {
    return { allowed: true, enforced: false, level: null };
  }
  const allowed = moduleSatisfies(access, module, required);
  return { allowed, enforced: true, level: access[module]?.level ?? "none" };
}

/**
 * Boolean check for server actions / API routes. Does not redirect.
 * Returns true when access is allowed OR when the engine cannot enforce (defers to upstream gate).
 */
export async function staffModuleAccessAllowed(
  tenantId: string,
  module: StaffAccessModuleKey,
  required: StaffAccessLevel = "read"
): Promise<boolean> {
  const decision = await evaluateStaffModuleAccess(tenantId, module, required);
  return decision.allowed;
}

/**
 * Hard guard for module routes: redirects to the tenant home when a resolved staff principal
 * lacks the required access. Place after the route's existing portal gate.
 */
export async function assertStaffModuleAccess(
  tenantId: string,
  module: StaffAccessModuleKey,
  required: StaffAccessLevel = "read",
  opts?: { redirectTo?: string }
): Promise<void> {
  // Local/dev keeps legacy open access (mirrors assertFiTenantPortalAccess behaviour).
  if (process.env.NODE_ENV !== "production") return;

  const decision = await evaluateStaffModuleAccess(tenantId, module, required);
  if (decision.allowed) return;
  redirect(opts?.redirectTo ?? `/fi-admin/${tenantId.trim()}`);
}

/** Convenience wrappers for the common actions. */
export function assertViewStaffModule(tenantId: string, module: StaffAccessModuleKey) {
  return assertStaffModuleAccess(tenantId, module, "read");
}
export function assertEditStaffModule(tenantId: string, module: StaffAccessModuleKey) {
  return assertStaffModuleAccess(tenantId, module, "edit");
}
export function assertApproveStaffModule(tenantId: string, module: StaffAccessModuleKey) {
  return assertStaffModuleAccess(tenantId, module, "approve");
}
