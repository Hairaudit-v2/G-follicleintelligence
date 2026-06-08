/**
 * Tenant backend admin roles (fi_tenant_admin_users.admin_role).
 * Separate from fi_staff / clinical roles and from fi_users.role legacy CRM values.
 */

export const FI_TENANT_ADMIN_ROLES = [
  "clinic_admin",
  "finance_admin",
  "operations_admin",
  "dashboard_viewer",
  "data_safety_admin",
] as const;

export type FiTenantAdminRole = (typeof FI_TENANT_ADMIN_ROLES)[number];

/** Short capability blurbs for Admin Users UI (non-clinical platform access). */
export const FI_TENANT_ADMIN_ROLE_CAPABILITIES: Record<FiTenantAdminRole, string> = {
  clinic_admin: "Full clinic settings, user management, reporting, dashboards.",
  finance_admin: "Revenue, invoices, payments, finance reporting.",
  operations_admin: "Tasks, workflow, reminders, scheduling operations.",
  dashboard_viewer: "Read-only analytics.",
  data_safety_admin: "Audit logs, security review, compliance monitoring.",
};

export const FI_TENANT_ADMIN_USER_STATUSES = ["invited", "active", "suspended"] as const;
export type FiTenantAdminUserStatus = (typeof FI_TENANT_ADMIN_USER_STATUSES)[number];

export function isFiTenantAdminRoleString(v: string | null | undefined): v is FiTenantAdminRole {
  return FI_TENANT_ADMIN_ROLES.includes(String(v ?? "").trim() as FiTenantAdminRole);
}

export function normalizeFiTenantAdminRole(v: string | null | undefined): FiTenantAdminRole | null {
  const t = String(v ?? "").trim().toLowerCase();
  return isFiTenantAdminRoleString(t) ? t : null;
}

/** May open Admin Users settings and invite/change/suspend tenant backend admins. */
export function canManageTenantAdminUsersFromProfiles(opts: {
  tenantFiUserRole: string | null | undefined;
  activeTenantAdminRole: FiTenantAdminRole | null;
}): boolean {
  const r = String(opts.tenantFiUserRole ?? "").trim().toLowerCase();
  if (r === "admin" || r === "fi_admin") return true;
  return opts.activeTenantAdminRole === "clinic_admin";
}

/** CRM shell nav (LeadFlow, system status, etc.): legacy roles or selected backend admin roles. */
export function tenantAdminRoleAllowsCrmShellNav(role: FiTenantAdminRole | null): boolean {
  if (!role) return false;
  return role === "clinic_admin" || role === "operations_admin";
}

/** Bookings / PatientOS / calendar operator surfaces (not finance-only or read-only dashboard). */
export function tenantAdminRoleAllowsBookingsBoardNav(role: FiTenantAdminRole | null): boolean {
  if (!role) return false;
  return role === "clinic_admin" || role === "operations_admin";
}

/** Read-only dashboard / AnalyticsOS-style read paths. */
export function tenantAdminRoleAllowsAnalyticsNav(role: FiTenantAdminRole | null): boolean {
  if (!role) return false;
  return (
    role === "clinic_admin" ||
    role === "finance_admin" ||
    role === "operations_admin" ||
    role === "dashboard_viewer" ||
    role === "data_safety_admin"
  );
}
