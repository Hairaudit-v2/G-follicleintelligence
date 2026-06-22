/**
 * OnboardingOS tenant provisioning — pure deterministic helpers.
 * Safe for unit tests; no server-only imports.
 */

import { FI_OS_MODULE_CODES, isFiModuleCode } from "@/src/lib/platform/entitlements/modules";
import { FI_TENANT_ADMIN_ROLES } from "@/src/lib/tenantAdmin/tenantAdminRoles";

import type {
  ProvisioningAuditSnapshot,
  ProvisioningInput,
  ProvisioningModuleTemplate,
  ProvisioningRoleTemplate,
  ProvisioningSessionStatus,
  ProvisioningStatusBadge,
  ProvisioningStepCode,
  ProvisioningStepDefinition,
  ProvisioningStepProgress,
  ProvisioningStepStatus,
} from "./tenantProvisioningTypes";
import { PROVISIONING_STEP_CODES } from "./tenantProvisioningTypes";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STEP_LABELS: Record<ProvisioningStepCode, { label: string; description: string }> = {
  validate_input: {
    label: "Validate input",
    description: "Verify tenant name, slug, timezone, and admin email.",
  },
  check_slug_availability: {
    label: "Check slug availability",
    description: "Ensure the tenant slug is not already reserved.",
  },
  provision_tenant_core: {
    label: "Provision tenant core",
    description: "Create tenant, default clinic, settings, and first clinic admin.",
  },
  apply_module_entitlements: {
    label: "Apply module entitlements",
    description: "Enable FI OS modules from the onboarding template (trialing — no Stripe).",
  },
  apply_verification_status: {
    label: "Apply verification status",
    description: "Set tenant verification gate for paid modules.",
  },
  ready_for_review: {
    label: "Ready for review",
    description: "Mark session ready for platform admin review before go-live.",
  },
  finalize: {
    label: "Finalize",
    description: "Complete onboarding and close the provisioning session.",
  },
};

/** Derive a URL-safe tenant slug from an organisation name. */
export function buildTenantSlug(tenantName: string): string {
  const base = String(tenantName ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!base) return "";
  return base.slice(0, 80);
}

/** Ordered provisioning steps for Phase A (no billing/CRM connectors). */
export function buildProvisioningSteps(): ProvisioningStepDefinition[] {
  return PROVISIONING_STEP_CODES.map((stepCode, index) => {
    const meta = STEP_LABELS[stepCode];
    return {
      stepCode,
      stepOrder: index + 1,
      label: meta.label,
      description: meta.description,
    };
  });
}

export function calculateProvisioningProgress(
  steps: readonly { status: ProvisioningStepStatus }[]
): ProvisioningStepProgress {
  const totalSteps = steps.length;
  let completedSteps = 0;
  let failedSteps = 0;
  let runningSteps = 0;
  let pendingSteps = 0;

  for (const step of steps) {
    switch (step.status) {
      case "completed":
      case "skipped":
        completedSteps += 1;
        break;
      case "failed":
        failedSteps += 1;
        break;
      case "running":
        runningSteps += 1;
        break;
      default:
        pendingSteps += 1;
        break;
    }
  }

  const percent = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

  return {
    totalSteps,
    completedSteps,
    failedSteps,
    runningSteps,
    pendingSteps,
    percent,
  };
}

export function resolveProvisioningStatusBadge(status: ProvisioningSessionStatus): ProvisioningStatusBadge {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "neutral" };
    case "in_progress":
      return { label: "In progress", tone: "info" };
    case "ready_for_review":
      return { label: "Ready for review", tone: "warning" };
    case "completed":
      return { label: "Completed", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: String(status), tone: "neutral" };
  }
}

export function resolveProvisioningStepStatusBadge(status: ProvisioningStepStatus): ProvisioningStatusBadge {
  switch (status) {
    case "pending":
      return { label: "Pending", tone: "neutral" };
    case "running":
      return { label: "Running", tone: "info" };
    case "completed":
      return { label: "Completed", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    case "skipped":
      return { label: "Skipped", tone: "neutral" };
    case "retry_pending":
      return { label: "Retry pending", tone: "warning" };
    default:
      return { label: String(status), tone: "neutral" };
  }
}

export type ProvisioningInputValidationResult =
  | { ok: true; value: ProvisioningInput }
  | { ok: false; errors: string[] };

/** Validate onboarding input before creating a provisioning session. */
export function validateProvisioningInput(raw: unknown): ProvisioningInputValidationResult {
  const errors: string[] = [];
  const input = (raw ?? {}) as Record<string, unknown>;

  const tenantName = String(input.tenantName ?? "").trim();
  const tenantSlug = String(input.tenantSlug ?? "").trim().toLowerCase();
  const defaultClinicDisplayName = String(input.defaultClinicDisplayName ?? "").trim();
  const defaultTimezone = String(input.defaultTimezone ?? "").trim();
  const firstTenantAdminEmail = String(input.firstTenantAdminEmail ?? "").trim().toLowerCase();
  const supportEmailRaw = input.supportEmail;
  const supportEmail =
    supportEmailRaw == null || String(supportEmailRaw).trim() === ""
      ? null
      : String(supportEmailRaw).trim().toLowerCase();
  const templateCode =
    input.templateCode == null || String(input.templateCode).trim() === ""
      ? null
      : String(input.templateCode).trim();

  if (!tenantName) errors.push("Tenant name is required.");
  if (tenantName.length > 200) errors.push("Tenant name must be 200 characters or fewer.");
  if (!tenantSlug) errors.push("Tenant slug is required.");
  if (tenantSlug.length > 80) errors.push("Tenant slug must be 80 characters or fewer.");
  if (tenantSlug && !SLUG_PATTERN.test(tenantSlug)) {
    errors.push("Slug must use lowercase letters, digits, and single hyphens between segments.");
  }
  if (!defaultClinicDisplayName) errors.push("Default clinic display name is required.");
  if (!defaultTimezone) errors.push("Default timezone is required.");
  if (defaultTimezone.length > 120) errors.push("Default timezone must be 120 characters or fewer.");
  if (!firstTenantAdminEmail) errors.push("First tenant admin email is required.");
  if (firstTenantAdminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firstTenantAdminEmail)) {
    errors.push("First tenant admin email must be a valid email address.");
  }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    errors.push("Support email must be a valid email address.");
  }

  const enabledModuleCodes = Array.isArray(input.enabledModuleCodes)
    ? input.enabledModuleCodes.map((c) => String(c).trim()).filter(Boolean)
    : null;
  if (enabledModuleCodes?.length) {
    for (const code of enabledModuleCodes) {
      if (!isFiModuleCode(code)) {
        errors.push(`Unknown module code: ${code}`);
      }
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      tenantName,
      tenantSlug,
      defaultClinicDisplayName,
      defaultTimezone,
      firstTenantAdminEmail,
      supportEmail,
      templateCode,
      enabledModuleCodes,
    },
  };
}

/** Default tenant backend admin role template for Phase A. */
export function buildDefaultRoleTemplate(): ProvisioningRoleTemplate {
  return {
    primaryAdminRole: "clinic_admin",
    additionalRoles: FI_TENANT_ADMIN_ROLES.filter((r) => r !== "clinic_admin"),
  };
}

/** Default module entitlement template — trialing, no Stripe connector. */
export function buildDefaultModuleTemplate(): ProvisioningModuleTemplate {
  return {
    subscriptionStatus: "trialing",
    verificationStatus: "verified",
    enabledModules: ["reception_os", "consultation_os", "patient_os", "analytics_os"],
  };
}

/** Resolve module template with optional overrides from session input. */
export function resolveModuleTemplateFromInput(input: ProvisioningInput): ProvisioningModuleTemplate {
  const base = buildDefaultModuleTemplate();
  const overrides = input.enabledModuleCodes?.filter(isFiModuleCode) ?? null;
  if (overrides?.length) {
    return { ...base, enabledModules: overrides };
  }
  return base;
}

/** Whether a failed step can be retried (Phase A policy). */
export function canRetryProvisioningStep(opts: {
  status: ProvisioningStepStatus;
  attemptCount: number;
  maxAttempts: number;
}): boolean {
  if (opts.status !== "failed" && opts.status !== "retry_pending") return false;
  return opts.attemptCount < opts.maxAttempts;
}

/** Status after a retry is requested on a failed step. */
export function provisioningStepStatusAfterRetryRequest(
  currentStatus: ProvisioningStepStatus
): ProvisioningStepStatus {
  if (currentStatus === "failed" || currentStatus === "retry_pending") {
    return "retry_pending";
  }
  return currentStatus;
}

/** Build a deterministic audit snapshot for provisioning events. */
export function buildProvisioningAuditSnapshot(opts: {
  sessionId: string;
  tenantId: string | null;
  tenantSlug: string;
  sessionStatus: ProvisioningSessionStatus;
  eventKind: string;
  stepCode?: string | null;
  progressPercent: number;
  detail?: Record<string, unknown>;
  capturedAt?: string;
}): ProvisioningAuditSnapshot {
  return {
    sessionId: opts.sessionId,
    tenantId: opts.tenantId,
    tenantSlug: opts.tenantSlug,
    sessionStatus: opts.sessionStatus,
    eventKind: opts.eventKind,
    stepCode: opts.stepCode ?? null,
    progressPercent: opts.progressPercent,
    capturedAt: opts.capturedAt ?? new Date(0).toISOString(),
    detail: opts.detail ?? {},
  };
}

/** All known FI OS module codes (for admin UI pickers). */
export function listAvailableModuleCodesForProvisioning(): readonly string[] {
  return FI_OS_MODULE_CODES;
}
