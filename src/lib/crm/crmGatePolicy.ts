/**
 * Pure CRM access policy (Stage 2D). Safe to import from unit tests.
 */

import { canUseDevelopmentClinicFeaturesFromFiUserRole } from "@/src/lib/fiOs/developmentClinicAccess";

export const CRM_MUTATION_ROLES_LOWER = new Set(["fi_admin", "admin", "crm_operator", "owner"]);

/** Roles that may read PHI clinical notes via authenticated Supabase client (RLS-aligned). */
export const CLINICAL_PHI_READ_ROLES_LOWER = new Set([
  ...CRM_MUTATION_ROLES_LOWER,
  "doctor",
  "nurse",
  "consultant",
  "surgeon",
]);

export function isClinicalPhiReadRole(role: string | null | undefined): boolean {
  return CLINICAL_PHI_READ_ROLES_LOWER.has(
    String(role ?? "")
      .trim()
      .toLowerCase()
  );
}

/** Staff directory CRUD: `fi_admin` / `admin` only (not `crm_operator`). */
export const CRM_STAFF_MANAGE_ROLES_LOWER = new Set(["fi_admin", "admin"]);

/** CRM shell nav + FI Admin route guard (Stage 2E): tenant `admin`, `fi_admin`, or delegated `crm_operator`. */
export const CRM_SHELL_NAV_ROLES_LOWER = new Set(["admin", "fi_admin", "crm_operator"]);

/** @deprecated Prefer {@link canUseDevelopmentClinicFeaturesFromFiUserRole} or session `canUseClinicFeatures`. */
export function isCrmMutationRole(role: string | null | undefined): boolean {
  return canUseDevelopmentClinicFeaturesFromFiUserRole(role);
}

/** Client helper when session exposes `canUseClinicFeatures` from the server resolver. */
export function canMutateClinicFromOperatorContext(opts: {
  userRole: string;
  canUseClinicFeatures?: boolean;
}): boolean {
  if (opts.canUseClinicFeatures === true) return true;
  return canUseDevelopmentClinicFeaturesFromFiUserRole(opts.userRole);
}

export function isCrmStaffManageRole(role: string | null | undefined): boolean {
  return CRM_STAFF_MANAGE_ROLES_LOWER.has(
    String(role ?? "")
      .trim()
      .toLowerCase()
  );
}

export function isCrmShellNavRole(role: string | null | undefined): boolean {
  return CRM_SHELL_NAV_ROLES_LOWER.has(
    String(role ?? "")
      .trim()
      .toLowerCase()
  );
}
