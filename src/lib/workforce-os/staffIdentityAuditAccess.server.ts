import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export type StaffIdentityAuditAccess = {
  allowed: boolean;
};

/** Route-aligned read access for Identity Audit — matches HR OS route gate. */
export async function resolveStaffIdentityAuditAccess(
  tenantId: string
): Promise<StaffIdentityAuditAccess> {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  return { allowed: access.ok };
}

export async function assertStaffIdentityAuditAccess(tenantId: string): Promise<boolean> {
  const { allowed } = await resolveStaffIdentityAuditAccess(tenantId);
  return allowed;
}
