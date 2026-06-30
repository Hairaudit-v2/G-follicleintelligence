/**
 * Tenant-scoped capability flags for `fi_tenant_admin_users` personas.
 * Pure module — safe for unit tests; server code resolves session → capability set.
 */

import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

export const FI_TENANT_ADMIN_CAPABILITIES = [
  "view_dashboards",
  "view_finance",
  "manage_finance_settings",
  "manage_clinic_settings",
  "manage_admin_users",
  "manage_operations",
  "view_security_audit",
  "view_read_only_reports",
] as const;

export type FiTenantAdminCapability = (typeof FI_TENANT_ADMIN_CAPABILITIES)[number];

const ALL: FiTenantAdminCapability[] = [...FI_TENANT_ADMIN_CAPABILITIES];

/** Every capability (used for clinic_admin + legacy full-access roles). */
export const ALL_TENANT_ADMIN_CAPABILITIES: ReadonlySet<FiTenantAdminCapability> =
  new Set<FiTenantAdminCapability>(ALL);

const CLINIC_ADMIN: ReadonlySet<FiTenantAdminCapability> = new Set<FiTenantAdminCapability>(ALL);

const FINANCE_ADMIN: ReadonlySet<FiTenantAdminCapability> = new Set<FiTenantAdminCapability>([
  "view_dashboards",
  "view_finance",
  "manage_finance_settings",
  "view_read_only_reports",
]);

const OPERATIONS_ADMIN: ReadonlySet<FiTenantAdminCapability> = new Set<FiTenantAdminCapability>([
  "view_dashboards",
  "manage_operations",
  "view_read_only_reports",
]);

const DASHBOARD_VIEWER: ReadonlySet<FiTenantAdminCapability> = new Set<FiTenantAdminCapability>([
  "view_dashboards",
  "view_read_only_reports",
]);

const DATA_SAFETY_ADMIN: ReadonlySet<FiTenantAdminCapability> = new Set<FiTenantAdminCapability>([
  "view_dashboards",
  "view_security_audit",
  "view_read_only_reports",
]);

const BY_ROLE: Record<FiTenantAdminRole, ReadonlySet<FiTenantAdminCapability>> = {
  clinic_admin: CLINIC_ADMIN,
  finance_admin: FINANCE_ADMIN,
  operations_admin: OPERATIONS_ADMIN,
  dashboard_viewer: DASHBOARD_VIEWER,
  data_safety_admin: DATA_SAFETY_ADMIN,
};

export function capabilitiesForTenantAdminRole(
  role: FiTenantAdminRole
): ReadonlySet<FiTenantAdminCapability> {
  return BY_ROLE[role];
}

export function hasTenantAdminCapability(
  caps: ReadonlySet<FiTenantAdminCapability> | null | undefined,
  cap: FiTenantAdminCapability
): boolean {
  return Boolean(caps?.has(cap));
}

/** Preserves CRM operator behaviour without granting admin-user management. */
export function crmOperatorCapabilityPreset(): ReadonlySet<FiTenantAdminCapability> {
  return OPERATIONS_ADMIN;
}
