/**
 * OnboardingOS tenant provisioning — pure deterministic helpers.
 * Safe for unit tests; no server-only imports.
 */

import { FI_OS_MODULE_CODES, isFiModuleCode } from "@/src/lib/platform/entitlements/modules";
import {
  FI_TENANT_ADMIN_ROLES,
  isFiTenantAdminRoleString,
} from "@/src/lib/tenantAdmin/tenantAdminRoles";

import {
  CLINIC_DEPLOYMENT_TEMPLATES,
  isClinicDeploymentTemplateCode,
  LEGACY_TEMPLATE_CODE_MAP,
  MODULE_BUNDLES,
  ROLE_PACKS,
} from "./clinicDeploymentCatalog";
import {
  isSandboxSeedPackCode,
  SANDBOX_SEED_DEFAULT_PACK_BY_TEMPLATE,
  SANDBOX_SEED_ENTITY_LABELS,
  SANDBOX_SEED_PACKS,
  SANDBOX_SEED_SOURCE,
} from "./sandboxSeedCatalog";
import type {
  AcademyAssignmentPlan,
  ClinicDeploymentPlan,
  ClinicDeploymentTemplate,
  ClinicDeploymentTemplateCode,
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
  SandboxSeedEntityType,
  SandboxSeedHistoryEntry,
  SandboxSeedPack,
  SandboxSeedPackCode,
  SandboxSeedPlan,
  SandboxSeedPreview,
  SandboxSeedRequest,
  SandboxSeedStepPlan,
  SandboxSeedValidationResult,
  SandboxSeedOption,
  ServiceWorkflowPack,
  TemplateReadinessResult,
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
  deploy_clinic_configuration: {
    label: "Deploy clinic configuration",
    description:
      "Apply service catalog from deployment template (workflows stored as plan — no CRM import).",
  },
  assign_academy_training: {
    label: "Assign AcademyOS training",
    description: "Build AcademyOS training track assignment plan from deployment template.",
  },
  prepare_sandbox_seed: {
    label: "Prepare sandbox seed",
    description: "Generate optional demo seed plan when sandbox mode is enabled.",
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

/** Ordered provisioning steps for Phase B (no billing/CRM connectors). */
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

export function resolveProvisioningStatusBadge(
  status: ProvisioningSessionStatus
): ProvisioningStatusBadge {
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

export function resolveProvisioningStepStatusBadge(
  status: ProvisioningStepStatus
): ProvisioningStatusBadge {
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
  const tenantSlug = String(input.tenantSlug ?? "")
    .trim()
    .toLowerCase();
  const defaultClinicDisplayName = String(input.defaultClinicDisplayName ?? "").trim();
  const defaultTimezone = String(input.defaultTimezone ?? "").trim();
  const firstTenantAdminEmail = String(input.firstTenantAdminEmail ?? "")
    .trim()
    .toLowerCase();
  const supportEmailRaw = input.supportEmail;
  const supportEmail =
    supportEmailRaw == null || String(supportEmailRaw).trim() === ""
      ? null
      : String(supportEmailRaw).trim().toLowerCase();
  const templateCode =
    input.templateCode == null || String(input.templateCode).trim() === ""
      ? null
      : String(input.templateCode).trim();
  const deploymentTemplateCode =
    input.deploymentTemplateCode == null || String(input.deploymentTemplateCode).trim() === ""
      ? null
      : String(input.deploymentTemplateCode).trim();

  if (deploymentTemplateCode && !isClinicDeploymentTemplateCode(deploymentTemplateCode)) {
    errors.push(`Unknown deployment template code: ${deploymentTemplateCode}`);
  }

  const sandboxSeedEnabled =
    input.sandboxSeedEnabled == null ? null : Boolean(input.sandboxSeedEnabled);

  if (!tenantName) errors.push("Tenant name is required.");
  if (tenantName.length > 200) errors.push("Tenant name must be 200 characters or fewer.");
  if (!tenantSlug) errors.push("Tenant slug is required.");
  if (tenantSlug.length > 80) errors.push("Tenant slug must be 80 characters or fewer.");
  if (tenantSlug && !SLUG_PATTERN.test(tenantSlug)) {
    errors.push("Slug must use lowercase letters, digits, and single hyphens between segments.");
  }
  if (!defaultClinicDisplayName) errors.push("Default clinic display name is required.");
  if (!defaultTimezone) errors.push("Default timezone is required.");
  if (defaultTimezone.length > 120)
    errors.push("Default timezone must be 120 characters or fewer.");
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
      deploymentTemplateCode,
      enabledModuleCodes,
      sandboxSeedEnabled,
    },
  };
}

/** Resolve a deployment template code from session input (Phase B) or legacy template code. */
export function resolveDeploymentTemplateCode(
  input: ProvisioningInput
): ClinicDeploymentTemplateCode {
  const explicit = input.deploymentTemplateCode?.trim();
  if (explicit && isClinicDeploymentTemplateCode(explicit)) return explicit;

  const legacy = input.templateCode?.trim();
  if (legacy && isClinicDeploymentTemplateCode(legacy)) return legacy;
  if (legacy && LEGACY_TEMPLATE_CODE_MAP[legacy]) return LEGACY_TEMPLATE_CODE_MAP[legacy];

  return "standard_hair_restoration";
}

/** Build a fully resolved clinic deployment template from catalog. */
export function buildClinicDeploymentTemplate(
  templateCode: ClinicDeploymentTemplateCode | string
): ClinicDeploymentTemplate | null {
  const code = String(templateCode ?? "").trim();
  if (!isClinicDeploymentTemplateCode(code)) return null;
  return CLINIC_DEPLOYMENT_TEMPLATES[code];
}

/** Resolve a module bundle by code with optional module overrides from session input. */
export function resolveModuleBundle(
  bundleCode: string,
  input?: ProvisioningInput | null
): ProvisioningModuleTemplate & { code: string; displayName: string } {
  const bundle = MODULE_BUNDLES[bundleCode] ?? MODULE_BUNDLES.core_clinic;
  const overrides = input?.enabledModuleCodes?.filter(isFiModuleCode) ?? null;
  return {
    code: bundle.code,
    displayName: bundle.displayName,
    subscriptionStatus: bundle.subscriptionStatus,
    verificationStatus: bundle.verificationStatus,
    enabledModules: overrides?.length ? overrides : [...bundle.enabledModules],
  };
}

/** Resolve role pack from catalog code. */
export function resolveRolePack(
  rolePackCode: string
): ProvisioningRoleTemplate & { code: string; displayName: string } {
  const pack = ROLE_PACKS[rolePackCode] ?? ROLE_PACKS.standard_clinic_roles;
  return {
    code: pack.code,
    displayName: pack.displayName,
    primaryAdminRole: pack.primaryAdminRole,
    additionalRoles: [...pack.additionalRoles],
  };
}

/** Resolve service + workflow pack for a deployment template. */
export function resolveServiceWorkflowPack(
  template: ClinicDeploymentTemplate
): ServiceWorkflowPack {
  return {
    serviceTemplates: [...template.serviceTemplates],
    workflowTemplates: [...template.workflowTemplates],
  };
}

/** Build AcademyOS training assignment plan from deployment template. */
export function buildAcademyAssignmentPlan(
  template: ClinicDeploymentTemplate,
  moduleBundle?: { enabledModules: readonly string[] }
): AcademyAssignmentPlan {
  const hasAcademy = moduleBundle?.enabledModules.includes("academy_os") ?? false;
  const assignments = hasAcademy
    ? [...template.academyAssignments]
    : template.academyAssignments.filter((a) => !a.mandatory);

  return {
    templateCode: template.code,
    assignments,
    mandatoryCount: assignments.filter((a) => a.mandatory).length,
    optionalCount: assignments.filter((a) => !a.mandatory).length,
  };
}

/** Resolve sandbox toggles from template defaults and session override. */
export function resolveSandboxSeedOption(
  template: ClinicDeploymentTemplate,
  input?: ProvisioningInput | null
): SandboxSeedOption {
  if (input?.sandboxSeedEnabled === false) {
    return { ...template.sandboxSeed, enabled: false };
  }
  if (input?.sandboxSeedEnabled === true) {
    return {
      enabled: true,
      includeDemoPatients: true,
      includeDemoBookings: true,
      includeDemoStaff: true,
    };
  }
  return template.sandboxSeed;
}

/** Prepare sandbox seed step plan from deployment template and session overrides (Phase B step). */
export function prepareSandboxSeedPlan(
  template: ClinicDeploymentTemplate,
  input?: ProvisioningInput | null
): SandboxSeedStepPlan {
  const seed = resolveSandboxSeedOption(template, input);

  const items: SandboxSeedStepPlan["items"] = [
    {
      kind: "demo_patients",
      description: "Sample patient records for walkthrough",
      included: seed.enabled && seed.includeDemoPatients,
    },
    {
      kind: "demo_bookings",
      description: "Sample calendar bookings linked to services",
      included: seed.enabled && seed.includeDemoBookings,
    },
    {
      kind: "demo_staff",
      description: "Sample staff roster with working hours",
      included: seed.enabled && seed.includeDemoStaff,
    },
  ];

  return { enabled: seed.enabled, templateCode: template.code, items };
}

/** Assess deployment template readiness before provisioning. */
export function calculateTemplateReadiness(
  template: ClinicDeploymentTemplate,
  input?: ProvisioningInput | null
): TemplateReadinessResult {
  const issues: TemplateReadinessResult["issues"][number][] = [];
  const moduleBundle = resolveModuleBundle(template.moduleBundleCode, input);
  const rolePack = ROLE_PACKS[template.rolePackCode] ?? ROLE_PACKS.standard_clinic_roles;

  if (!MODULE_BUNDLES[template.moduleBundleCode]) {
    issues.push({
      code: "unknown_module_bundle",
      severity: "blocker",
      message: `Module bundle "${template.moduleBundleCode}" is not defined.`,
    });
  }

  if (!ROLE_PACKS[template.rolePackCode]) {
    issues.push({
      code: "unknown_role_pack",
      severity: "blocker",
      message: `Role pack "${template.rolePackCode}" is not defined.`,
    });
  }

  for (const mod of moduleBundle.enabledModules) {
    if (!isFiModuleCode(mod)) {
      issues.push({
        code: "invalid_module",
        severity: "blocker",
        message: `Unknown module code in bundle: ${mod}`,
      });
    }
  }

  if (!isFiTenantAdminRoleString(rolePack.primaryAdminRole)) {
    issues.push({
      code: "invalid_primary_role",
      severity: "blocker",
      message: `Primary admin role "${rolePack.primaryAdminRole}" is not recognized.`,
    });
  }

  if (template.serviceTemplates.length === 0) {
    issues.push({
      code: "no_services",
      severity: "warning",
      message: "Template has no service catalog entries.",
    });
  }

  const hasAcademyModule = moduleBundle.enabledModules.includes("academy_os");
  if (hasAcademyModule && template.academyAssignments.length === 0) {
    issues.push({
      code: "academy_module_no_tracks",
      severity: "warning",
      message: "Academy OS is enabled but no training tracks are assigned.",
    });
  }

  if (!hasAcademyModule && template.academyAssignments.some((a) => a.mandatory)) {
    issues.push({
      code: "mandatory_academy_without_module",
      severity: "warning",
      message: "Mandatory Academy tracks defined but academy_os is not in the module bundle.",
    });
  }

  const sandboxEnabled =
    input?.sandboxSeedEnabled != null ? input.sandboxSeedEnabled : template.sandboxSeed.enabled;

  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - blockers * 25 - warnings * 5);

  return {
    ready: blockers === 0,
    score,
    issues,
    summary: {
      moduleCount: moduleBundle.enabledModules.length,
      roleCount: 1 + rolePack.additionalRoles.length,
      serviceCount: template.serviceTemplates.length,
      workflowCount: template.workflowTemplates.length,
      academyTrackCount: template.academyAssignments.length,
      sandboxEnabled,
    },
  };
}

/** Build a resolved deployment plan for session storage. */
export function buildClinicDeploymentPlan(input: ProvisioningInput): ClinicDeploymentPlan {
  const templateCode = resolveDeploymentTemplateCode(input);
  const template = CLINIC_DEPLOYMENT_TEMPLATES[templateCode];
  const rolePack = ROLE_PACKS[template.rolePackCode] ?? ROLE_PACKS.standard_clinic_roles;
  const moduleBundle = resolveModuleBundle(template.moduleBundleCode, input);
  const sandboxSeed = resolveSandboxSeedOption(template, input);

  return {
    templateCode,
    templateDisplayName: template.displayName,
    rolePack,
    moduleBundle,
    serviceTemplates: [...template.serviceTemplates],
    workflowTemplates: [...template.workflowTemplates],
    academyAssignments: [...template.academyAssignments],
    sandboxSeed,
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

/** Resolve module template from deployment plan or legacy defaults. */
export function resolveModuleTemplateFromInput(
  input: ProvisioningInput
): ProvisioningModuleTemplate {
  const deploymentCode = resolveDeploymentTemplateCode(input);
  const template = CLINIC_DEPLOYMENT_TEMPLATES[deploymentCode];
  const resolved = resolveModuleBundle(template.moduleBundleCode, input);
  return {
    subscriptionStatus: resolved.subscriptionStatus,
    verificationStatus: resolved.verificationStatus,
    enabledModules: resolved.enabledModules,
  };
}

/** Resolve role template from deployment plan or legacy defaults. */
export function resolveRoleTemplateFromInput(input: ProvisioningInput): ProvisioningRoleTemplate {
  const deploymentCode = resolveDeploymentTemplateCode(input);
  const template = CLINIC_DEPLOYMENT_TEMPLATES[deploymentCode];
  const pack = ROLE_PACKS[template.rolePackCode] ?? ROLE_PACKS.standard_clinic_roles;
  return {
    primaryAdminRole: pack.primaryAdminRole,
    additionalRoles: [...pack.additionalRoles],
  };
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

/** List available FI OS module codes (for admin UI pickers). */
export function listAvailableModuleCodesForProvisioning(): readonly string[] {
  return FI_OS_MODULE_CODES;
}

/** Build standard metadata stamped on every sandbox-seeded record. */
export function buildSandboxSeedRecordMetadata(opts: {
  seedPack: SandboxSeedPackCode;
  sessionId: string;
  generatedAt: string;
  entityKey: string;
  entityType?: SandboxSeedEntityType;
}): Record<string, unknown> {
  return {
    demo_data: true,
    source: SANDBOX_SEED_SOURCE,
    seed_pack: opts.seedPack,
    session_id: opts.sessionId,
    generated_at: opts.generatedAt,
    sandbox_entity_key: opts.entityKey,
    ...(opts.entityType ? { entity_type: opts.entityType } : {}),
  };
}

/** Resolve a sandbox seed pack by explicit code or deployment template default. */
export function resolveSandboxSeedPack(
  templateCode: ClinicDeploymentTemplateCode,
  packCode?: SandboxSeedPackCode | string | null
): SandboxSeedPack | null {
  const explicit = String(packCode ?? "").trim();
  if (explicit && isSandboxSeedPackCode(explicit)) return SANDBOX_SEED_PACKS[explicit];
  return (
    SANDBOX_SEED_PACKS[SANDBOX_SEED_DEFAULT_PACK_BY_TEMPLATE[templateCode] ?? "standard_demo"] ??
    null
  );
}

/** Sum entity counts for a pack (optionally filtered by deployment toggles). */
export function calculateSandboxSeedSize(
  pack: SandboxSeedPack,
  deploymentPlan?: ClinicDeploymentPlan | null
): number {
  let total = 0;
  for (const entityType of Object.keys(pack.counts) as SandboxSeedEntityType[]) {
    const count = pack.counts[entityType];
    if (count <= 0) continue;
    if (deploymentPlan && !isSandboxEntityIncluded(entityType, deploymentPlan)) continue;
    total += count;
  }
  return total;
}

function isSandboxEntityIncluded(
  entityType: SandboxSeedEntityType,
  plan: ClinicDeploymentPlan
): boolean {
  const { sandboxSeed, moduleBundle } = plan;
  if (!sandboxSeed.enabled) return false;
  if (entityType === "staff") return sandboxSeed.includeDemoStaff;
  if (entityType === "patients" || entityType === "leads" || entityType === "consultations") {
    return sandboxSeed.includeDemoPatients;
  }
  if (entityType === "appointments") return sandboxSeed.includeDemoBookings;
  if (entityType === "surgeries" || entityType === "surgery_os_metrics") {
    return moduleBundle.enabledModules.includes("surgery_os");
  }
  if (
    entityType === "invoices" ||
    entityType === "payments" ||
    entityType === "financial_os_metrics"
  ) {
    return moduleBundle.enabledModules.includes("financial_os");
  }
  if (entityType === "academy_readiness") {
    return moduleBundle.enabledModules.includes("academy_os");
  }
  return true;
}

/** Deterministic fingerprint for idempotency checks. */
export function buildSandboxSeedFingerprint(opts: {
  sessionId: string;
  packCode: SandboxSeedPackCode;
  templateCode: ClinicDeploymentTemplateCode;
  generatedAt: string;
}): string {
  return `onboarding_os_sandbox:${opts.sessionId}:${opts.packCode}:${opts.templateCode}:${opts.generatedAt.slice(0, 10)}`;
}

/** Build a Phase C sandbox seed plan for preview/apply. */
export function buildSandboxSeedPlan(opts: {
  sessionId: string;
  tenantId: string | null;
  tenantSlug: string;
  templateCode: ClinicDeploymentTemplateCode;
  deploymentPlan: ClinicDeploymentPlan;
  packCode?: SandboxSeedPackCode | string | null;
  generatedAt?: string;
}): SandboxSeedPlan | null {
  const pack = resolveSandboxSeedPack(opts.templateCode, opts.packCode);
  if (!pack) return null;

  const generatedAt = opts.generatedAt ?? new Date(0).toISOString();
  const sandboxEnabled = opts.deploymentPlan.sandboxSeed.enabled;

  const entities = (Object.keys(pack.counts) as SandboxSeedEntityType[]).map((entityType) => {
    const count = pack.counts[entityType];
    const included =
      sandboxEnabled && count > 0 && isSandboxEntityIncluded(entityType, opts.deploymentPlan);
    return {
      entityType,
      label: SANDBOX_SEED_ENTITY_LABELS[entityType],
      count,
      included,
    };
  });

  const totalRecords = entities.filter((e) => e.included).reduce((sum, e) => sum + e.count, 0);

  return {
    packCode: pack.code,
    packDisplayName: pack.displayName,
    sessionId: opts.sessionId,
    tenantId: opts.tenantId,
    tenantSlug: opts.tenantSlug,
    templateCode: opts.templateCode,
    sandboxEnabled,
    entities,
    totalRecords,
    generatedAt,
    seedFingerprint: buildSandboxSeedFingerprint({
      sessionId: opts.sessionId,
      packCode: pack.code,
      templateCode: opts.templateCode,
      generatedAt,
    }),
  };
}

/** Build a human-readable preview from a plan and optional history. */
export function buildSandboxSeedPreview(opts: {
  plan: SandboxSeedPlan;
  history?: readonly SandboxSeedHistoryEntry[] | null;
  warnings?: readonly string[];
}): SandboxSeedPreview {
  const history = opts.history ?? [];
  const matching = history.filter(
    (h) => h.sessionId === opts.plan.sessionId && h.packCode === opts.plan.packCode
  );
  const last = history.length ? history[history.length - 1] : null;

  return {
    plan: opts.plan,
    warnings: opts.warnings ?? [],
    alreadyApplied: matching.length > 0,
    lastAppliedAt: last?.appliedAt ?? null,
  };
}

/** Whether a tenant should be treated as live (sandbox seeding blocked). */
export function isSandboxSeedTenantLive(opts: {
  sessionStatus: ProvisioningSessionStatus;
  tenantBillingStatus?: string | null;
  tenantSettingsMetadata?: Record<string, unknown> | null;
}): boolean {
  if (opts.sessionStatus === "completed") return true;
  const meta = opts.tenantSettingsMetadata ?? {};
  if (meta.is_live === true) return true;
  if (typeof meta.go_live_at === "string" && meta.go_live_at.trim()) return true;
  if (opts.tenantBillingStatus === "active") return true;
  return false;
}

/** Validate a sandbox seed apply request (pure guards — auth enforced server-side). */
export function validateSandboxSeedRequest(opts: {
  request: SandboxSeedRequest;
  sessionStatus: ProvisioningSessionStatus;
  sandboxEnabled: boolean;
  tenantId: string | null;
  tenantBillingStatus?: string | null;
  tenantSettingsMetadata?: Record<string, unknown> | null;
  history?: readonly SandboxSeedHistoryEntry[] | null;
  templateCode: ClinicDeploymentTemplateCode;
}): SandboxSeedValidationResult {
  const pack = resolveSandboxSeedPack(opts.templateCode, opts.request.packCode);
  if (!pack) {
    return { ok: false, errorCode: "unknown_pack", error: "Unknown sandbox seed pack." };
  }

  if (!opts.sandboxEnabled) {
    return {
      ok: false,
      errorCode: "sandbox_disabled",
      error: "Sandbox seed is disabled for this session.",
    };
  }

  if (!opts.tenantId) {
    return {
      ok: false,
      errorCode: "tenant_missing",
      error: "Tenant must be provisioned before applying sandbox seed.",
    };
  }

  if (isSandboxSeedTenantLive(opts)) {
    return {
      ok: false,
      errorCode: "tenant_live",
      error: "Sandbox seed cannot be applied to a live tenant.",
    };
  }

  if (!opts.request.force) {
    const applied = (opts.history ?? []).some(
      (h) => h.sessionId === opts.request.sessionId && h.packCode === pack.code
    );
    if (applied) {
      return {
        ok: false,
        errorCode: "already_applied",
        error: "Sandbox seed pack was already applied. Pass force=true to re-apply.",
      };
    }
  }

  return { ok: true, packCode: pack.code, sandboxEnabled: opts.sandboxEnabled };
}

export function parseSandboxSeedHistory(metadata: unknown): SandboxSeedHistoryEntry[] {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).sandbox_seed_history;
  if (!Array.isArray(raw)) return [];
  const entries: SandboxSeedHistoryEntry[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const packCode = String(row.packCode ?? row.pack_code ?? "").trim();
    if (!isSandboxSeedPackCode(packCode)) continue;
    entries.push({
      packCode,
      appliedAt: String(row.appliedAt ?? row.applied_at ?? ""),
      entityCounts: (row.entityCounts ?? row.entity_counts ?? {}) as Partial<
        Record<SandboxSeedEntityType, number>
      >,
      actorAuthUserId: row.actorAuthUserId != null ? String(row.actorAuthUserId) : null,
      sessionId: String(row.sessionId ?? row.session_id ?? ""),
      seedFingerprint: String(row.seedFingerprint ?? row.seed_fingerprint ?? ""),
    });
  }
  return entries;
}
