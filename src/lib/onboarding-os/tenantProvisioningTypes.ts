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
  "deploy_clinic_configuration",
  "assign_academy_training",
  "prepare_sandbox_seed",
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
  deploymentTemplateCode?: string | null;
  enabledModuleCodes?: string[] | null;
  sandboxSeedEnabled?: boolean | null;
};

/** Phase B — named role preset for tenant backend + staff documentation. */
export type RolePack = {
  code: string;
  displayName: string;
  primaryAdminRole: string;
  additionalRoles: readonly string[];
  staffRoleSeeds?: readonly string[];
};

/** Phase B — named module entitlement preset. */
export type ModuleBundle = {
  code: string;
  displayName: string;
  subscriptionStatus: "trialing" | "active";
  verificationStatus: "verified" | "enterprise_verified";
  enabledModules: readonly string[];
};

/** Phase B — procedure catalog row to deploy from template. */
export type ServiceTemplate = {
  code: string;
  name: string;
  bookingType: string;
  durationMinutes: number;
  category: string;
  basePrice?: number;
  color?: string;
};

/** Phase B — workflow/reminder/pipeline preset (template-only until CRM connectors). */
export type WorkflowTemplate = {
  code: string;
  name: string;
  type: "crm_pipeline" | "reminder" | "consultation_checklist" | "booking_workflow";
  config: Record<string, unknown>;
};

/** Phase B — AcademyOS training track assignment plan. */
export type AcademyTrainingAssignment = {
  trackCode: string;
  trackName: string;
  targetRoles: readonly string[];
  mandatory: boolean;
};

/** Phase B — optional sandbox demo seed toggles on deployment template. */
export type SandboxSeedOption = {
  enabled: boolean;
  includeDemoPatients: boolean;
  includeDemoBookings: boolean;
  includeDemoStaff: boolean;
};

/** Phase C — named deterministic demo data pack. */
export const SANDBOX_SEED_PACK_CODES = ["light_demo", "standard_demo", "enterprise_demo"] as const;
export type SandboxSeedPackCode = (typeof SANDBOX_SEED_PACK_CODES)[number];

/** Phase C — entity categories seeded into a sandbox tenant. */
export const SANDBOX_SEED_ENTITY_TYPES = [
  "patients",
  "leads",
  "appointments",
  "consultations",
  "surgeries",
  "invoices",
  "payments",
  "staff",
  "academy_readiness",
  "surgery_os_metrics",
  "financial_os_metrics",
] as const;
export type SandboxSeedEntityType = (typeof SANDBOX_SEED_ENTITY_TYPES)[number];

export type SandboxSeedPackEntityCounts = Record<SandboxSeedEntityType, number>;

export type SandboxSeedPack = {
  code: SandboxSeedPackCode;
  displayName: string;
  description: string;
  counts: SandboxSeedPackEntityCounts;
  recommendedTemplateCodes?: readonly ClinicDeploymentTemplateCode[];
};

/** Phase B provisioning step output — high-level seed toggles only. */
export type SandboxSeedStepPlan = {
  enabled: boolean;
  templateCode: ClinicDeploymentTemplateCode;
  items: readonly { kind: string; description: string; included: boolean }[];
};

/** Phase C — resolved sandbox seed plan for preview/apply. */
export type SandboxSeedPlan = {
  packCode: SandboxSeedPackCode;
  packDisplayName: string;
  sessionId: string;
  tenantId: string | null;
  tenantSlug: string;
  templateCode: ClinicDeploymentTemplateCode;
  sandboxEnabled: boolean;
  entities: readonly {
    entityType: SandboxSeedEntityType;
    label: string;
    count: number;
    included: boolean;
  }[];
  totalRecords: number;
  generatedAt: string;
  seedFingerprint: string;
};

export type SandboxSeedPreview = {
  plan: SandboxSeedPlan;
  warnings: readonly string[];
  alreadyApplied: boolean;
  lastAppliedAt: string | null;
};

export type SandboxSeedEntityCounts = Partial<
  Record<SandboxSeedEntityType, { created: number; existing: number; skipped?: number }>
>;

export type SandboxSeedResult = {
  ok: boolean;
  plan: SandboxSeedPlan;
  appliedAt: string;
  entityCounts: SandboxSeedEntityCounts;
  skippedReason?: string;
  warnings: readonly string[];
};

export type SandboxSeedHistoryEntry = {
  packCode: SandboxSeedPackCode;
  appliedAt: string;
  entityCounts: Partial<Record<SandboxSeedEntityType, number>>;
  actorAuthUserId?: string | null;
  sessionId: string;
  seedFingerprint: string;
};

export type SandboxSeedRequest = {
  sessionId: string;
  packCode?: SandboxSeedPackCode | null;
  force?: boolean;
};

export type SandboxSeedValidationResult =
  | { ok: true; packCode: SandboxSeedPackCode; sandboxEnabled: boolean }
  | { ok: false; errorCode: string; error: string };

export const CLINIC_DEPLOYMENT_TEMPLATE_CODES = [
  "standard_hair_restoration",
  "surgical_hair_restoration",
  "growth_consultation",
  "enterprise_multi_clinic",
] as const;

export type ClinicDeploymentTemplateCode = (typeof CLINIC_DEPLOYMENT_TEMPLATE_CODES)[number];

/** Phase B — full clinic deployment template definition. */
export type ClinicDeploymentTemplate = {
  code: ClinicDeploymentTemplateCode;
  displayName: string;
  description: string;
  rolePackCode: string;
  moduleBundleCode: string;
  serviceTemplates: readonly ServiceTemplate[];
  workflowTemplates: readonly WorkflowTemplate[];
  academyAssignments: readonly AcademyTrainingAssignment[];
  sandboxSeed: SandboxSeedOption;
};

/** Resolved deployment plan stored on a provisioning session. */
export type ClinicDeploymentPlan = {
  templateCode: ClinicDeploymentTemplateCode;
  templateDisplayName: string;
  rolePack: RolePack;
  moduleBundle: ModuleBundle;
  serviceTemplates: readonly ServiceTemplate[];
  workflowTemplates: readonly WorkflowTemplate[];
  academyAssignments: readonly AcademyTrainingAssignment[];
  sandboxSeed: SandboxSeedOption;
};

export type ServiceWorkflowPack = {
  serviceTemplates: readonly ServiceTemplate[];
  workflowTemplates: readonly WorkflowTemplate[];
};

export type AcademyAssignmentPlan = {
  templateCode: ClinicDeploymentTemplateCode;
  assignments: readonly AcademyTrainingAssignment[];
  mandatoryCount: number;
  optionalCount: number;
};

export type TemplateReadinessIssue = {
  code: string;
  severity: "blocker" | "warning";
  message: string;
};

export type TemplateReadinessResult = {
  ready: boolean;
  score: number;
  issues: readonly TemplateReadinessIssue[];
  summary: {
    moduleCount: number;
    roleCount: number;
    serviceCount: number;
    workflowCount: number;
    academyTrackCount: number;
    sandboxEnabled: boolean;
  };
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
