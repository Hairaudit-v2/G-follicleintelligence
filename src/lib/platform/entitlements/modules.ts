/**
 * FI OS module registry and pure entitlement policy helpers.
 * Safe for unit tests and client nav helpers (no server-only imports).
 */

import type {
  ClientSafeTenantEntitlements,
  EntitlementAccessContext,
  FiSubscriptionStatus,
  FiTenantVerificationStatus,
  ModuleAccessDenialReason,
  ModuleAccessResult,
} from "./entitlementTypes";

export const FI_OS_MODULE_CODES = [
  "reception_os",
  "consultation_os",
  "patient_os",
  "surgery_os",
  "financial_os",
  "imaging_os",
  "audit_os",
  "academy_os",
  "analytics_os",
  "hr_os",
] as const;

export type FiModuleCode = (typeof FI_OS_MODULE_CODES)[number];

const MODULE_CODE_SET = new Set<string>(FI_OS_MODULE_CODES);

/** Fallback defaults when DB row is missing — kept aligned with migration seed. */
export const FI_MODULE_DEFAULT_ALLOWED_ROLES: Readonly<Record<FiModuleCode, readonly string[]>> = {
  reception_os: ["admin", "fi_admin", "owner", "crm_operator", "tenant_backend"],
  consultation_os: ["admin", "fi_admin", "owner", "crm_operator", "tenant_backend", "consultant"],
  patient_os: ["admin", "fi_admin", "owner", "tenant_backend", "consultant", "doctor", "nurse"],
  surgery_os: ["admin", "fi_admin", "owner", "tenant_backend", "doctor", "nurse"],
  financial_os: ["admin", "fi_admin", "owner", "tenant_backend", "finance_admin"],
  imaging_os: ["admin", "fi_admin", "owner", "tenant_backend", "consultant", "doctor", "nurse"],
  audit_os: ["admin", "fi_admin", "owner", "tenant_backend", "data_safety_admin"],
  academy_os: ["admin", "fi_admin", "owner", "tenant_backend"],
  analytics_os: ["admin", "fi_admin", "owner", "tenant_backend", "dashboard_viewer"],
  hr_os: ["admin", "fi_admin", "owner", "tenant_backend", "crm_operator", "hr_manager"],
};

export const FI_MODULE_DISPLAY_NAMES: Readonly<Record<FiModuleCode, string>> = {
  reception_os: "Reception OS",
  consultation_os: "Consultation OS",
  patient_os: "Patient OS",
  surgery_os: "Surgery OS",
  financial_os: "Financial OS",
  imaging_os: "Imaging OS",
  audit_os: "Audit OS",
  academy_os: "Academy OS",
  analytics_os: "Analytics OS",
  hr_os: "HR OS",
};

export function isFiModuleCode(value: string | null | undefined): value is FiModuleCode {
  return MODULE_CODE_SET.has(String(value ?? "").trim());
}

export function defaultAllowedRolesForModule(moduleCode: string): readonly string[] {
  if (isFiModuleCode(moduleCode)) {
    return FI_MODULE_DEFAULT_ALLOWED_ROLES[moduleCode];
  }
  return [];
}

export function isTenantVerificationAllowed(
  status: FiTenantVerificationStatus | null | undefined
): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return s === "verified" || s === "enterprise_verified";
}

export function isSubscriptionStatusEntitled(
  status: FiSubscriptionStatus | null | undefined
): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return s === "active" || s === "trialing";
}

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "")
    .trim()
    .toLowerCase();
}

function normalizeRoleList(roles: readonly string[]): string[] {
  return roles.map((r) => normalizeRole(r)).filter(Boolean);
}

export function isUserRoleAllowedForModule(opts: {
  userRole: string | null | undefined;
  allowedRoles: readonly string[];
  requiredRoles?: readonly string[] | null;
}): boolean {
  const role = normalizeRole(opts.userRole);
  if (!role) return false;

  const allowed = new Set(normalizeRoleList(opts.allowedRoles));
  if (!allowed.size || !allowed.has(role)) return false;

  const required = opts.requiredRoles?.length ? normalizeRoleList(opts.requiredRoles) : null;
  if (required?.length && !required.includes(role)) return false;

  return true;
}

const DENIAL_MESSAGES: Record<ModuleAccessDenialReason, string> = {
  tenant_not_found: "This clinic workspace is not available.",
  tenant_unverified: "This clinic workspace is not yet activated for paid modules.",
  billing_inactive: "This module is not available on your current plan.",
  module_not_found: "This module is not recognized.",
  module_disabled: "This module is not enabled for your clinic.",
  user_not_found: "You do not have access to this clinic workspace.",
  role_not_allowed: "Your role does not include access to this module.",
};

export function moduleAccessDenialMessage(reason: ModuleAccessDenialReason): string {
  return DENIAL_MESSAGES[reason];
}

/**
 * Pure access evaluation — used by server gates and unit tests.
 */
export function evaluateModuleAccess(
  ctx: EntitlementAccessContext,
  opts?: { requiredRoles?: readonly string[] | null }
): ModuleAccessResult {
  if (!ctx.tenantExists) {
    return { ok: false, reason: "tenant_not_found", message: DENIAL_MESSAGES.tenant_not_found };
  }
  if (!isTenantVerificationAllowed(ctx.verificationStatus)) {
    return { ok: false, reason: "tenant_unverified", message: DENIAL_MESSAGES.tenant_unverified };
  }
  if (!isSubscriptionStatusEntitled(ctx.subscriptionStatus)) {
    return { ok: false, reason: "billing_inactive", message: DENIAL_MESSAGES.billing_inactive };
  }
  if (!ctx.moduleExists) {
    return { ok: false, reason: "module_not_found", message: DENIAL_MESSAGES.module_not_found };
  }
  if (!ctx.moduleEnabled) {
    return { ok: false, reason: "module_disabled", message: DENIAL_MESSAGES.module_disabled };
  }
  if (!ctx.userExists || !ctx.userRole) {
    return { ok: false, reason: "user_not_found", message: DENIAL_MESSAGES.user_not_found };
  }
  if (
    !isUserRoleAllowedForModule({
      userRole: ctx.userRole,
      allowedRoles: ctx.allowedRoles,
      requiredRoles: opts?.requiredRoles,
    })
  ) {
    return { ok: false, reason: "role_not_allowed", message: DENIAL_MESSAGES.role_not_allowed };
  }

  return {
    ok: true,
    tenantId: "",
    userId: "",
    moduleCode: "",
    userRole: ctx.userRole,
  };
}

/** Whether a module nav item should render for the current user. */
export function canShowModuleNav(
  entitlements: ClientSafeTenantEntitlements | null | undefined,
  moduleCode: string
): boolean {
  if (!entitlements) return false;
  const code = String(moduleCode ?? "").trim();
  if (!code) return false;
  return Boolean(entitlements.modules[code]?.showInNav);
}

export function resolveEffectiveAllowedRoles(
  moduleCode: string,
  tenantAllowedRoles: string[] | null | undefined,
  moduleDefaultRoles: string[] | null | undefined
): string[] {
  const tenantRoles = tenantAllowedRoles?.filter((r) => String(r).trim()) ?? [];
  if (tenantRoles.length) return tenantRoles;
  const moduleRoles = moduleDefaultRoles?.filter((r) => String(r).trim()) ?? [];
  if (moduleRoles.length) return moduleRoles;
  return [...defaultAllowedRolesForModule(moduleCode)];
}

export const HR_OS_MODULE_CODE = "hr_os" as const;

/** Tighter HR OS route gate on top of module allow-list. */
export const HR_OS_ROUTE_REQUIRED_ROLES = ["owner", "admin", "hr_manager"] as const;

/** Pure HR OS entitlement check — used by route gate and unit tests. */
export function evaluateHrOsModuleEntitlement(ctx: EntitlementAccessContext): ModuleAccessResult {
  return evaluateModuleAccess(ctx, { requiredRoles: HR_OS_ROUTE_REQUIRED_ROLES });
}
