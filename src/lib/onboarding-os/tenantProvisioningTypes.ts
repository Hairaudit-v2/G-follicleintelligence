/**
 * OnboardingOS tenant provisioning types — safe for core unit tests (no server-only).
 */

export const PROVISIONING_SESSION_STATUSES = [
  "draft",
  "in_progress",
  "ready_for_review",
  "completed",
  "failed",
  "cancelled",
] as const;

export type ProvisioningSessionStatus = (typeof PROVISIONING_SESSION_STATUSES)[number];

export const PROVISIONING_STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "retry_pending",
] as const;

export type ProvisioningStepStatus = (typeof PROVISIONING_STEP_STATUSES)[number];

export const PROVISIONING_STEP_CODES = [
  "validate_input",
  "check_slug_availability",
  "provision_tenant_core",
  "apply_module_entitlements",
  "apply_verification_status",
  "ready_for_review",
  "finalize",
] as const;

export type ProvisioningStepCode = (typeof PROVISIONING_STEP_CODES)[number];

export type ProvisioningStepDefinition = {
  stepCode: ProvisioningStepCode;
  stepOrder: number;
  label: string;
  description: string;
};

export type ProvisioningInput = {
  tenantName: string;
  tenantSlug: string;
  defaultClinicDisplayName: string;
  defaultTimezone: string;
  firstTenantAdminEmail: string;
  supportEmail?: string | null;
  templateCode?: string | null;
  enabledModuleCodes?: string[] | null;
};

export type ProvisioningRoleTemplate = {
  primaryAdminRole: string;
  additionalRoles: readonly string[];
};

export type ProvisioningModuleTemplate = {
  subscriptionStatus: "trialing" | "active";
  verificationStatus: "verified" | "enterprise_verified";
  enabledModules: readonly string[];
};

export type ProvisioningStepProgress = {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  runningSteps: number;
  pendingSteps: number;
  percent: number;
};

export type ProvisioningStatusBadge = {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

export type ProvisioningAuditSnapshot = {
  sessionId: string;
  tenantId: string | null;
  tenantSlug: string;
  sessionStatus: ProvisioningSessionStatus;
  eventKind: string;
  stepCode: string | null;
  progressPercent: number;
  capturedAt: string;
  detail: Record<string, unknown>;
};
