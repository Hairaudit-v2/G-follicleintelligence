import "server-only";

import {
  canApproveField,
  canEditField,
  canExportField,
  canViewField,
  fieldPermissionSatisfies,
} from "./staffFieldAccessCore";
import { getStaffEffectiveFieldAccess, getStaffFieldPermission } from "./staffFieldAccess.server";
import { getStaffFieldDefinition, type StaffFieldPermissionLevel } from "./staffFieldAccessRegistry";

/**
 * SA-2 field guards.
 *
 * These run AFTER the SA-1 module guards. They add the field-level check on top:
 *
 *   - Field access is a SECOND gate inside module access. It NEVER replaces module access — the
 *     effective field permission is already clamped to the SA-1 module level by the core, so a
 *     field guard can never grant more than the module guard allows.
 *   - When no principal resolves (legacy/admin session with no fi_staff mapping), the guard
 *     defers (returns allowed) so the rollout stays progressive and non-destructive, exactly like
 *     the SA-1 guards.
 *
 * Use these in server actions / API routes to gate field-level reads, edits, approvals, and the
 * separate `export` action.
 */

export type StaffFieldAccessDecision = {
  allowed: boolean;
  /** True when a principal resolved and the engine made a real decision. */
  enforced: boolean;
  level: StaffFieldPermissionLevel | null;
  /** True when the module ceiling clamped the requested level down. */
  clamped: boolean;
};

export async function evaluateStaffFieldAccess(
  tenantId: string,
  fieldKey: string,
  required: StaffFieldPermissionLevel = "read"
): Promise<StaffFieldAccessDecision> {
  const { principal, fieldAccess } = await getStaffEffectiveFieldAccess(tenantId);
  if (!principal) {
    // No mappable principal — defer to the upstream module/portal gate.
    return { allowed: true, enforced: false, level: null, clamped: false };
  }
  if (principal.isAdminOverride) {
    const perm = fieldAccess[fieldKey];
    return { allowed: true, enforced: true, level: perm?.level ?? "export", clamped: false };
  }
  if (!principal.staffMemberId || !principal.roleKey) {
    return { allowed: true, enforced: false, level: null, clamped: false };
  }
  const perm = fieldAccess[fieldKey];
  const level = perm?.level ?? "hidden";
  return {
    allowed: fieldPermissionSatisfies(level, required),
    enforced: true,
    level,
    clamped: perm?.clamped ?? false,
  };
}

/** Boolean check for server actions / API routes (does not throw). */
export async function staffFieldAccessAllowed(
  tenantId: string,
  fieldKey: string,
  required: StaffFieldPermissionLevel = "read"
): Promise<boolean> {
  const decision = await evaluateStaffFieldAccess(tenantId, fieldKey, required);
  return decision.allowed;
}

/**
 * Throwing guard for server actions / API routes. Unlike the SA-1 route guard it does NOT
 * redirect — field access typically gates data within an already-allowed page, so callers want
 * an error (or to catch and redact) rather than a navigation. Throws only when a principal is
 * enforced and lacks the required level.
 */
export async function assertStaffFieldAccess(
  tenantId: string,
  fieldKey: string,
  required: StaffFieldPermissionLevel = "read"
): Promise<void> {
  const decision = await evaluateStaffFieldAccess(tenantId, fieldKey, required);
  if (decision.allowed) return;
  const def = getStaffFieldDefinition(fieldKey);
  const label = def?.label ?? fieldKey;
  throw new Error(`Field access denied: ${label} requires ${required} permission.`);
}

/** Convenience wrappers for the current viewer (resolve once, check the level). */
export async function viewerCanViewField(tenantId: string, fieldKey: string): Promise<boolean> {
  return canViewField((await getStaffFieldPermission(tenantId, fieldKey)).level);
}
export async function viewerCanEditField(tenantId: string, fieldKey: string): Promise<boolean> {
  return canEditField((await getStaffFieldPermission(tenantId, fieldKey)).level);
}
export async function viewerCanApproveField(tenantId: string, fieldKey: string): Promise<boolean> {
  return canApproveField((await getStaffFieldPermission(tenantId, fieldKey)).level);
}
export async function viewerCanExportField(tenantId: string, fieldKey: string): Promise<boolean> {
  return canExportField((await getStaffFieldPermission(tenantId, fieldKey)).level);
}
