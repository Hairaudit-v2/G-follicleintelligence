/**
 * Platform entitlements — shared types (safe for client + server imports).
 */

export const FI_TENANT_VERIFICATION_STATUSES = ["unverified", "verified", "enterprise_verified"] as const;
export type FiTenantVerificationStatus = (typeof FI_TENANT_VERIFICATION_STATUSES)[number];

export const FI_SUBSCRIPTION_STATUSES = ["inactive", "trialing", "active", "past_due", "canceled"] as const;
export type FiSubscriptionStatus = (typeof FI_SUBSCRIPTION_STATUSES)[number];

export const MODULE_ACCESS_DENIAL_REASONS = [
  "tenant_not_found",
  "tenant_unverified",
  "billing_inactive",
  "module_not_found",
  "module_disabled",
  "user_not_found",
  "role_not_allowed",
] as const;
export type ModuleAccessDenialReason = (typeof MODULE_ACCESS_DENIAL_REASONS)[number];

export type ModuleAccessGranted = {
  ok: true;
  tenantId: string;
  userId: string;
  moduleCode: string;
  userRole: string;
};

export type ModuleAccessDenied = {
  ok: false;
  reason: ModuleAccessDenialReason;
  /** Safe client-facing message — never includes billing internals. */
  message: string;
};

export type ModuleAccessResult = ModuleAccessGranted | ModuleAccessDenied;

/** Client-safe module nav snapshot — no billing plan ids, prices, or subscription metadata. */
export type ClientSafeModuleEntitlement = {
  moduleCode: string;
  /** True when the signed-in user may enter module routes. */
  canAccess: boolean;
  /** True when the module should appear in navigation for this user. */
  showInNav: boolean;
};

export type ClientSafeTenantEntitlements = {
  tenantId: string;
  userId: string;
  modules: Readonly<Record<string, ClientSafeModuleEntitlement>>;
};

export type EntitlementAccessContext = {
  tenantExists: boolean;
  verificationStatus: FiTenantVerificationStatus | null;
  subscriptionStatus: FiSubscriptionStatus | null;
  moduleExists: boolean;
  moduleEnabled: boolean;
  allowedRoles: string[];
  userExists: boolean;
  userRole: string | null;
};

export type EntitlementAuditOutcome = "allowed" | "denied";

export type EntitlementAuditEventInput = {
  tenantId: string;
  fiUserId: string | null;
  moduleCode: string;
  outcome: EntitlementAuditOutcome;
  denialReason?: ModuleAccessDenialReason | null;
  source?: string;
  metadata?: Record<string, unknown>;
};
