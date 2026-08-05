import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/modules";

/** fi_users roles allowed to manage WorkforceOS HR operational actions (aligned with HR OS route gate). */
export const WORKFORCE_HR_MANAGE_ROLES = HR_OS_ROUTE_REQUIRED_ROLES;

export const WORKFORCE_HR_MANAGE_DENIED_MESSAGE =
  "Owner, fi_admin, admin, HR manager, or manager role required.";

export type WorkforceHrManageDecision = {
  canManage: boolean;
  manageDeniedReason: string;
};

/** Pure predicate — shared by page canManage and server action gates. */
export function workforceHrManageAllowedForRole(
  role: string | null | undefined,
  platformAdminPreview: boolean
): boolean {
  if (platformAdminPreview) return true;
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  return (WORKFORCE_HR_MANAGE_ROLES as readonly string[]).includes(normalized);
}
