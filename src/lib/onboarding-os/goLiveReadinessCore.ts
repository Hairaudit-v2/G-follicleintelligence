/**
 * OnboardingOS Phase E — deterministic go-live readiness engine (pure; no server-only).
 */

import type {
  ProvisioningStepCode,
  ProvisioningStepStatus,
  ClinicDeploymentPlan,
} from "./tenantProvisioningTypes";
import type {
  GoLiveReadinessCheck,
  GoLiveReadinessCheckCode,
  GoLiveReadinessRecommendation,
  GoLiveReadinessReviewStatus,
  GoLiveReadinessScore,
  GoLiveReadinessSnapshot,
  GoLiveReadinessStatus,
} from "./goLiveReadinessTypes";

export type GoLiveReadinessInputSignals = {
  sessionId: string;
  tenantId: string | null;
  tenantName: string;
  tenantSlug: string;
  stepStatuses: Partial<Record<ProvisioningStepCode, ProvisioningStepStatus>>;
  deploymentPlan: ClinicDeploymentPlan | null;
  sandboxSeedEnabled: boolean;
  sandboxSeedHistoryLength: number;
  clinicCount: number;
  enabledModuleCount: number;
  expectedModuleCount: number;
  serviceCount: number;
  expectedServiceCount: number;
  staffUserCount: number;
  adminRoleAssignedCount: number;
  guidedAssistConfigured: boolean;
  reviews: GoLiveReadinessReviewStatus;
  checklistReviewedCodes: readonly string[];
  generatedAt: string;
};

type CheckDefinition = {
  code: GoLiveReadinessCheckCode;
  area: GoLiveReadinessCheck["area"];
  label: string;
  description: string;
  severity: GoLiveReadinessCheck["severity"];
  evaluate: (signals: GoLiveReadinessInputSignals) => {
    state: GoLiveReadinessCheck["state"];
    detail: string | null;
  };
};

function stepCompleted(signals: GoLiveReadinessInputSignals, code: ProvisioningStepCode): boolean {
  return signals.stepStatuses[code] === "completed";
}

const CHECK_DEFINITIONS: readonly CheckDefinition[] = [
  {
    code: "tenant_shell_provisioned",
    area: "infrastructure",
    label: "Tenant shell provisioned",
    description: "Core tenant record, settings, and default organisation exist.",
    severity: "required",
    evaluate: (s) => ({
      state: s.tenantId != null && stepCompleted(s, "provision_tenant_core") ? "pass" : "fail",
      detail: s.tenantId ? null : "Tenant has not been provisioned yet.",
    }),
  },
  {
    code: "clinic_locations_created",
    area: "infrastructure",
    label: "Clinic locations created",
    description: "At least one clinic location is registered for the tenant.",
    severity: "required",
    evaluate: (s) => ({
      state: s.clinicCount > 0 ? "pass" : "fail",
      detail: s.clinicCount > 0 ? null : "No clinic locations found.",
    }),
  },
  {
    code: "modules_enabled",
    area: "deployment",
    label: "Modules enabled",
    description: "Expected FI OS module entitlements are active for the tenant.",
    severity: "required",
    evaluate: (s) => {
      const expected = s.expectedModuleCount > 0 ? s.expectedModuleCount : 1;
      const ok = s.enabledModuleCount >= expected && stepCompleted(s, "apply_module_entitlements");
      return {
        state: ok ? "pass" : "fail",
        detail: ok ? null : `Enabled ${s.enabledModuleCount} of ${expected} expected modules.`,
      };
    },
  },
  {
    code: "deployment_template_applied",
    area: "deployment",
    label: "Deployment template applied",
    description: "A clinic deployment template is resolved on the provisioning session.",
    severity: "required",
    evaluate: (s) => ({
      state: s.deploymentPlan != null ? "pass" : "fail",
      detail: s.deploymentPlan ? null : "No deployment template snapshot on session.",
    }),
  },
  {
    code: "service_catalog_deployed",
    area: "deployment",
    label: "Service catalog deployed",
    description: "Default services from the deployment template are present.",
    severity: "required",
    evaluate: (s) => {
      const expected = s.expectedServiceCount > 0 ? s.expectedServiceCount : 1;
      const ok = s.serviceCount >= expected && stepCompleted(s, "deploy_clinic_configuration");
      return {
        state: ok ? "pass" : "fail",
        detail: ok ? null : `Deployed ${s.serviceCount} of ${expected} expected services.`,
      };
    },
  },
  {
    code: "sandbox_seed_applied",
    area: "deployment",
    label: "Sandbox seed applied",
    description: "Demo training data pack applied when sandbox seed is enabled on the template.",
    severity: "optional",
    evaluate: (s) => {
      if (!s.sandboxSeedEnabled) {
        return { state: "skipped", detail: "Sandbox seed disabled on deployment template." };
      }
      const ok = s.sandboxSeedHistoryLength > 0 || stepCompleted(s, "prepare_sandbox_seed");
      return {
        state: ok ? "pass" : "fail",
        detail: ok ? null : "Sandbox seed is enabled but no pack has been applied.",
      };
    },
  },
  {
    code: "guided_assist_enabled",
    area: "training",
    label: "Guided Assist enabled",
    description: "Guided Assist tenant defaults are configured for onboarding support.",
    severity: "optional",
    evaluate: (s) => ({
      state: s.guidedAssistConfigured ? "pass" : "fail",
      detail: s.guidedAssistConfigured ? null : "Guided Assist tenant defaults not configured.",
    }),
  },
  {
    code: "staff_invited",
    area: "people",
    label: "Staff invited",
    description: "Additional staff beyond the initial tenant admin have been invited.",
    severity: "required",
    evaluate: (s) => ({
      state: s.staffUserCount > 1 ? "pass" : "fail",
      detail:
        s.staffUserCount > 1
          ? null
          : "Only the initial admin user exists — invite staff before go-live.",
    }),
  },
  {
    code: "roles_assigned",
    area: "people",
    label: "Roles assigned",
    description: "Tenant admin roles are assigned to operational staff.",
    severity: "required",
    evaluate: (s) => ({
      state: s.adminRoleAssignedCount >= 1 ? "pass" : "fail",
      detail: s.adminRoleAssignedCount >= 1 ? null : "No tenant admin roles assigned.",
    }),
  },
  {
    code: "academy_tracks_planned",
    area: "training",
    label: "Academy tracks planned",
    description: "AcademyOS training assignments from the deployment template are planned.",
    severity: "optional",
    evaluate: (s) => {
      const trackCount = s.deploymentPlan?.academyAssignments.length ?? 0;
      if (trackCount === 0) {
        return { state: "skipped", detail: "No academy tracks on deployment template." };
      }
      const ok = stepCompleted(s, "assign_academy_training");
      return {
        state: ok ? "pass" : "fail",
        detail: ok ? null : `${trackCount} academy track(s) pending assignment step.`,
      };
    },
  },
  {
    code: "key_workflows_configured",
    area: "deployment",
    label: "Key workflows configured",
    description: "Workflow presets from the deployment template are deployed.",
    severity: "optional",
    evaluate: (s) => {
      const workflowCount = s.deploymentPlan?.workflowTemplates.length ?? 0;
      if (workflowCount === 0) {
        return { state: "skipped", detail: "No workflow templates on deployment template." };
      }
      const ok = stepCompleted(s, "deploy_clinic_configuration");
      return {
        state: ok ? "pass" : "fail",
        detail: ok ? null : `${workflowCount} workflow preset(s) not yet deployed.`,
      };
    },
  },
  {
    code: "owner_review_complete",
    area: "governance",
    label: "Owner review complete",
    description: "Tenant owner or clinic admin has reviewed the go-live checklist.",
    severity: "required",
    evaluate: (s) => ({
      state: s.reviews.ownerReviewComplete ? "pass" : "fail",
      detail: s.reviews.ownerReviewComplete ? null : "Waiting for tenant owner review.",
    }),
  },
  {
    code: "platform_review_complete",
    area: "governance",
    label: "Platform review complete",
    description: "FI platform administrator has reviewed provisioning and readiness.",
    severity: "required",
    evaluate: (s) => ({
      state: s.reviews.platformReviewComplete ? "pass" : "fail",
      detail: s.reviews.platformReviewComplete ? null : "Waiting for platform admin review.",
    }),
  },
];

function isCheckPassing(check: GoLiveReadinessCheck): boolean {
  return check.state === "pass" || check.state === "skipped";
}

/** Build all deterministic readiness checks from input signals. */
export function buildGoLiveReadinessChecks(
  signals: GoLiveReadinessInputSignals
): GoLiveReadinessCheck[] {
  const reviewedSet = new Set(signals.checklistReviewedCodes);
  return CHECK_DEFINITIONS.map((def) => {
    const result = def.evaluate(signals);
    return {
      code: def.code,
      area: def.area,
      label: def.label,
      description: def.description,
      severity: def.severity,
      state: result.state,
      detail: result.detail,
      reviewed: reviewedSet.has(def.code),
    };
  });
}

/** Calculate weighted readiness score from checks. */
export function calculateGoLiveReadinessScore(
  checks: readonly GoLiveReadinessCheck[]
): GoLiveReadinessScore {
  const applicable = checks.filter((c) => c.state !== "skipped");
  const required = applicable.filter((c) => c.severity === "required");
  const optional = applicable.filter((c) => c.severity === "optional");

  const requiredPassed = required.filter(isCheckPassing).length;
  const optionalPassed = optional.filter(isCheckPassing).length;

  const requiredTotal = required.length;
  const optionalTotal = optional.length;
  const total = requiredTotal + optionalTotal;
  const passed = requiredPassed + optionalPassed;

  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);

  return {
    percent,
    requiredPassed,
    requiredTotal,
    optionalPassed,
    optionalTotal,
  };
}

/** Resolve overall readiness status from checks and approval state. */
export function resolveGoLiveReadinessStatus(
  checks: readonly GoLiveReadinessCheck[],
  reviews: GoLiveReadinessReviewStatus
): GoLiveReadinessStatus {
  if (reviews.goLiveApproved) return "approved";

  const requiredFailed = checks.some((c) => c.severity === "required" && c.state === "fail");
  if (requiredFailed) return "blocked";

  const optionalFailed = checks.some((c) => c.severity === "optional" && c.state === "fail");
  if (optionalFailed) return "warning";

  return "ready";
}

/** Build a full readiness snapshot. */
export function buildGoLiveReadinessSnapshot(
  signals: GoLiveReadinessInputSignals
): GoLiveReadinessSnapshot {
  const checks = buildGoLiveReadinessChecks(signals);
  const score = calculateGoLiveReadinessScore(checks);
  const status = resolveGoLiveReadinessStatus(checks, signals.reviews);
  const recommendations = generateGoLiveRecommendations(checks, signals.reviews);

  return {
    sessionId: signals.sessionId,
    tenantId: signals.tenantId,
    tenantSlug: signals.tenantSlug,
    tenantName: signals.tenantName,
    status,
    score,
    checks,
    recommendations,
    reviews: signals.reviews,
    generatedAt: signals.generatedAt,
    snapshotId: null,
  };
}

/** Generate actionable recommendations from failed checks and review gaps. */
export function generateGoLiveRecommendations(
  checks: readonly GoLiveReadinessCheck[],
  reviews: GoLiveReadinessReviewStatus
): GoLiveReadinessRecommendation[] {
  const recs: GoLiveReadinessRecommendation[] = [];

  for (const check of checks) {
    if (check.state !== "fail") continue;
    recs.push({
      code: `fix_${check.code}`,
      severity: check.severity === "required" ? "blocker" : "warning",
      title: check.label,
      message: check.detail ?? check.description,
      relatedCheckCode: check.code,
    });
  }

  if (!reviews.ownerReviewComplete) {
    recs.push({
      code: "complete_owner_review",
      severity: "blocker",
      title: "Complete owner review",
      message: "Tenant owner or clinic admin must review and sign off the go-live checklist.",
      relatedCheckCode: "owner_review_complete",
    });
  }

  if (!reviews.platformReviewComplete) {
    recs.push({
      code: "complete_platform_review",
      severity: "blocker",
      title: "Complete platform review",
      message:
        "FI platform administrator must review provisioning before production go-live approval.",
      relatedCheckCode: "platform_review_complete",
    });
  }

  if (
    reviews.ownerReviewComplete &&
    reviews.platformReviewComplete &&
    resolveGoLiveReadinessStatus(checks, reviews) === "ready"
  ) {
    recs.push({
      code: "await_platform_go_live_approval",
      severity: "info",
      title: "Ready for platform go-live approval",
      message: "All required checks pass. A platform administrator may approve production go-live.",
      relatedCheckCode: null,
    });
  }

  return recs;
}

/** Whether a platform admin may approve go-live (tenant admins may not). */
export function canPlatformAdminApproveGoLive(opts: {
  isPlatformAdmin: boolean;
  snapshot: GoLiveReadinessSnapshot;
}): { allowed: boolean; reason: string | null } {
  if (!opts.isPlatformAdmin) {
    return {
      allowed: false,
      reason: "Platform administrator access is required to approve go-live.",
    };
  }
  if (opts.snapshot.reviews.goLiveApproved) {
    return { allowed: false, reason: "Go-live has already been approved for this tenant." };
  }
  if (opts.snapshot.status === "blocked") {
    return {
      allowed: false,
      reason: "Critical readiness checks are failing — resolve blockers first.",
    };
  }
  if (!opts.snapshot.reviews.ownerReviewComplete) {
    return {
      allowed: false,
      reason: "Tenant owner review must be complete before go-live approval.",
    };
  }
  if (!opts.snapshot.reviews.platformReviewComplete) {
    return { allowed: false, reason: "Platform review must be complete before go-live approval." };
  }
  return { allowed: true, reason: null };
}

/** Shape for persisted platform go-live approval events. */
export function buildGoLiveApprovalEventDetail(
  snapshot: GoLiveReadinessSnapshot
): Record<string, unknown> {
  return {
    session_id: snapshot.sessionId,
    tenant_id: snapshot.tenantId,
    tenant_slug: snapshot.tenantSlug,
    readiness_status: snapshot.status,
    readiness_score_percent: snapshot.score.percent,
    required_passed: snapshot.score.requiredPassed,
    required_total: snapshot.score.requiredTotal,
    optional_passed: snapshot.score.optionalPassed,
    optional_total: snapshot.score.optionalTotal,
    generated_at: snapshot.generatedAt,
    safety: {
      billing_activation: false,
      crm_import: false,
      sandbox_cleanup: false,
    },
  };
}
