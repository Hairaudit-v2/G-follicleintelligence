/**
 * Stage 2A — development-phase ClinicOS / FI OS access policy.
 *
 * During build-out, authenticated admin and operations personas get full operational
 * access (calendar, bookings, patients/leads, consultations, setup tools).
 * Tighten these sets before production role hardening.
 */

import { isFiOsElevatedOsOperatorRole, isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";
import { normalizeFiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

/** Legacy `fi_users.role` values with full ClinicOS operational access during development. */
export const DEVELOPMENT_CLINIC_FI_USER_ROLES_LOWER = new Set([
  "fi_admin",
  "admin",
  "crm_operator",
  "owner",
  /** Ordinary clinic personas that already get CRM shell nav via `fi_users.role`. */
  "manager",
  "consultant",
]);

/**
 * Active `fi_staff.staff_role` values that grant ClinicOS mutations when `fi_users.role`
 * is a non-operator membership (typically `member`). Keep aligned with
 * `CRM_SHELL_NAV_STAFF_ROLES_LOWER` in `crmGatePolicy` so shell-eligible ordinary staff
 * can mutate Pipeline/calendar the same way platform-admin tenant proxy can.
 */
export const DEVELOPMENT_CLINIC_STAFF_ROLES_LOWER = new Set([
  "consultant",
  "reception",
  "receptionist",
  "manager",
  "owner",
]);

/** `fi_tenant_admin_users.admin_role` values with operational ClinicOS access during development. */
export const DEVELOPMENT_CLINIC_TENANT_ADMIN_ROLES_LOWER = new Set<FiTenantAdminRole>([
  "clinic_admin",
  "operations_admin",
]);

export type DevelopmentClinicAccessContext = {
  /** Must be true — never grant access to anonymous users. */
  isAuthenticated: boolean;
  fiUserRole?: string | null;
  /** Active `fi_staff.staff_role` for the tenant membership (ordinary staff path). */
  staffRole?: string | null;
  fiOsRole?: string | null;
  tenantAdminRole?: FiTenantAdminRole | null;
  /** Auth user id listed in `FI_DEVELOPMENT_ADMIN_AUTH_USER_IDS`. */
  isConfiguredDevelopmentAdmin?: boolean;
};

function normRole(role: string | null | undefined): string {
  return String(role ?? "")
    .trim()
    .toLowerCase();
}

export function isConfiguredDevelopmentAdminAuthUser(
  authUserId: string | null | undefined,
  configuredList: string | null | undefined = process.env.FI_DEVELOPMENT_ADMIN_AUTH_USER_IDS
): boolean {
  const id = authUserId?.trim();
  if (!id) return false;
  const raw = configuredList?.trim();
  if (!raw) return false;
  const ids = new Set(
    raw
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
  );
  return ids.has(id);
}

/**
 * Pure predicate — safe for client bundles and unit tests.
 * Aligns calendar quick-create, CRM mutations, dashboard actions, and setup tooling during development.
 */
export function canUseDevelopmentClinicFeatures(ctx: DevelopmentClinicAccessContext): boolean {
  if (!ctx.isAuthenticated) return false;
  if (ctx.isConfiguredDevelopmentAdmin) return true;
  if (isFiOsPlatformAdminRole(ctx.fiOsRole)) return true;
  if (isFiOsElevatedOsOperatorRole(ctx.fiOsRole)) return true;

  const fiRole = normRole(ctx.fiUserRole);
  if (fiRole && DEVELOPMENT_CLINIC_FI_USER_ROLES_LOWER.has(fiRole)) return true;

  const staffRole = normRole(ctx.staffRole);
  if (staffRole && DEVELOPMENT_CLINIC_STAFF_ROLES_LOWER.has(staffRole)) return true;

  const adminRole = normalizeFiTenantAdminRole(ctx.tenantAdminRole ?? null);
  if (adminRole && DEVELOPMENT_CLINIC_TENANT_ADMIN_ROLES_LOWER.has(adminRole)) return true;

  return false;
}

/** True when active `fi_staff.staff_role` is a ClinicOS operational staff persona. */
export function isDevelopmentClinicStaffRole(staffRole: string | null | undefined): boolean {
  return DEVELOPMENT_CLINIC_STAFF_ROLES_LOWER.has(normRole(staffRole));
}

/** Client/server helper when only `fi_users.role` is known (e.g. CRM shell session). */
export function canUseDevelopmentClinicFeaturesFromFiUserRole(
  role: string | null | undefined
): boolean {
  return canUseDevelopmentClinicFeatures({
    isAuthenticated: true,
    fiUserRole: role,
  });
}

/** @deprecated Prefer {@link canUseDevelopmentClinicFeaturesFromFiUserRole} — kept for gradual migration. */
export function isDevelopmentClinicMutationRole(role: string | null | undefined): boolean {
  return canUseDevelopmentClinicFeaturesFromFiUserRole(role);
}
