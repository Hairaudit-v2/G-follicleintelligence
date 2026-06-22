import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CLINIC_DEPLOYMENT_TEMPLATES } from "../src/lib/onboarding-os/clinicDeploymentCatalog";
import {
  buildAcademyAssignmentPlan,
  buildClinicDeploymentPlan,
  buildClinicDeploymentTemplate,
  buildDefaultModuleTemplate,
  buildDefaultRoleTemplate,
  buildProvisioningAuditSnapshot,
  buildProvisioningSteps,
  buildTenantSlug,
  calculateProvisioningProgress,
  calculateTemplateReadiness,
  canRetryProvisioningStep,
  prepareSandboxSeedPlan,
  provisioningStepStatusAfterRetryRequest,
  resolveModuleBundle,
  resolveServiceWorkflowPack,
  validateProvisioningInput,
} from "../src/lib/onboarding-os/tenantProvisioningCore";

const SAMPLE_INPUT = {
  tenantName: "Demo Clinic",
  tenantSlug: "demo-clinic",
  defaultClinicDisplayName: "Demo Clinic HQ",
  defaultTimezone: "Australia/Perth",
  firstTenantAdminEmail: "admin@demo-clinic.test",
  deploymentTemplateCode: "surgical_hair_restoration" as const,
};

describe("OnboardingOS Phase A — tenant provisioning core", () => {
  it("buildTenantSlug normalizes organisation names", () => {
    assert.equal(buildTenantSlug("Acme Hair Clinic"), "acme-hair-clinic");
    assert.equal(buildTenantSlug("  Follicle & Intelligence  "), "follicle-intelligence");
    assert.equal(buildTenantSlug("---"), "");
  });

  it("buildDefaultRoleTemplate includes clinic_admin primary role", () => {
    const roles = buildDefaultRoleTemplate();
    assert.equal(roles.primaryAdminRole, "clinic_admin");
    assert.ok(roles.additionalRoles.includes("finance_admin"));
    assert.ok(!roles.additionalRoles.includes("clinic_admin"));
  });

  it("buildDefaultModuleTemplate enables core modules with trialing status", () => {
    const modules = buildDefaultModuleTemplate();
    assert.equal(modules.subscriptionStatus, "trialing");
    assert.equal(modules.verificationStatus, "verified");
    assert.deepEqual(modules.enabledModules, ["reception_os", "consultation_os", "patient_os", "analytics_os"]);
  });

  it("calculateProvisioningProgress computes percent from step statuses", () => {
    const steps = buildProvisioningSteps().map((def, i) => ({
      status: i < 3 ? ("completed" as const) : ("pending" as const),
    }));
    const progress = calculateProvisioningProgress(steps);
    assert.equal(progress.totalSteps, 10);
    assert.equal(progress.completedSteps, 3);
    assert.equal(progress.percent, 30);
  });

  it("validateProvisioningInput rejects invalid slug and email", () => {
    const result = validateProvisioningInput({
      tenantName: "",
      tenantSlug: "Bad Slug!",
      defaultClinicDisplayName: "Clinic",
      defaultTimezone: "Australia/Perth",
      firstTenantAdminEmail: "not-an-email",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.includes("Tenant name")));
      assert.ok(result.errors.some((e) => e.includes("Slug")));
      assert.ok(result.errors.some((e) => e.includes("email")));
    }
  });

  it("validateProvisioningInput accepts valid input", () => {
    const result = validateProvisioningInput(SAMPLE_INPUT);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.tenantSlug, "demo-clinic");
      assert.equal(result.value.deploymentTemplateCode, "surgical_hair_restoration");
    }
  });

  it("failed step retry status transitions to retry_pending", () => {
    assert.equal(provisioningStepStatusAfterRetryRequest("failed"), "retry_pending");
    assert.equal(provisioningStepStatusAfterRetryRequest("completed"), "completed");
    assert.equal(
      canRetryProvisioningStep({ status: "failed", attemptCount: 1, maxAttempts: 3 }),
      true
    );
    assert.equal(
      canRetryProvisioningStep({ status: "failed", attemptCount: 3, maxAttempts: 3 }),
      false
    );
  });

  it("buildProvisioningAuditSnapshot has expected shape", () => {
    const snapshot = buildProvisioningAuditSnapshot({
      sessionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      tenantId: null,
      tenantSlug: "demo-clinic",
      sessionStatus: "draft",
      eventKind: "session.created",
      stepCode: null,
      progressPercent: 0,
      capturedAt: "2026-06-22T12:00:00.000Z",
      detail: { tenant_name: "Demo Clinic" },
    });

    assert.equal(snapshot.sessionId, "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    assert.equal(snapshot.tenantId, null);
    assert.equal(snapshot.tenantSlug, "demo-clinic");
    assert.equal(snapshot.sessionStatus, "draft");
    assert.equal(snapshot.eventKind, "session.created");
    assert.equal(snapshot.stepCode, null);
    assert.equal(snapshot.progressPercent, 0);
    assert.equal(snapshot.capturedAt, "2026-06-22T12:00:00.000Z");
    assert.deepEqual(snapshot.detail, { tenant_name: "Demo Clinic" });
  });
});

describe("OnboardingOS Phase B — clinic deployment templates", () => {
  it("buildClinicDeploymentTemplate returns catalog entry by code", () => {
    const template = buildClinicDeploymentTemplate("growth_consultation");
    assert.ok(template);
    assert.equal(template?.displayName, "Growth / Consultation Clinic");
    assert.ok(template?.serviceTemplates.some((s) => s.bookingType === "trichology"));
  });

  it("resolveModuleBundle returns bundle modules with optional overrides", () => {
    const bundle = resolveModuleBundle("surgical_clinic");
    assert.equal(bundle.code, "surgical_clinic");
    assert.ok(bundle.enabledModules.includes("surgery_os"));
    assert.ok(bundle.enabledModules.includes("academy_os"));

    const overridden = resolveModuleBundle("surgical_clinic", {
      ...SAMPLE_INPUT,
      enabledModuleCodes: ["reception_os", "patient_os"],
    });
    assert.deepEqual(overridden.enabledModules, ["reception_os", "patient_os"]);
  });

  it("resolveServiceWorkflowPack selects services and workflows for template", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.enterprise_multi_clinic;
    const pack = resolveServiceWorkflowPack(template);
    assert.ok(pack.serviceTemplates.some((s) => s.code === "surgery"));
    assert.ok(pack.workflowTemplates.some((w) => w.code === "multi_clinic_routing"));
    assert.equal(pack.serviceTemplates.length, template.serviceTemplates.length);
    assert.equal(pack.workflowTemplates.length, template.workflowTemplates.length);
  });

  it("buildAcademyAssignmentPlan includes mandatory tracks when academy_os enabled", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.surgical_hair_restoration;
    const plan = buildAcademyAssignmentPlan(template, { enabledModules: template.moduleBundleCode ? ["academy_os", "surgery_os"] : [] });
    assert.ok(plan.mandatoryCount >= 2);
    assert.ok(plan.assignments.some((a) => a.trackCode === "theatre_privileges_fue"));
  });

  it("buildAcademyAssignmentPlan filters mandatory tracks without academy_os module", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.surgical_hair_restoration;
    const plan = buildAcademyAssignmentPlan(template, { enabledModules: ["reception_os"] });
    assert.equal(plan.mandatoryCount, 0);
  });

  it("calculateTemplateReadiness scores surgical template as ready", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.surgical_hair_restoration;
    const readiness = calculateTemplateReadiness(template);
    assert.equal(readiness.ready, true);
    assert.ok(readiness.score >= 90);
    assert.ok(readiness.summary.serviceCount >= 4);
    assert.equal(readiness.summary.sandboxEnabled, false);
  });

  it("calculateTemplateReadiness warns when sandbox overridden on", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.surgical_hair_restoration;
    const readiness = calculateTemplateReadiness(template, { ...SAMPLE_INPUT, sandboxSeedEnabled: true });
    assert.equal(readiness.summary.sandboxEnabled, true);
  });

  it("prepareSandboxSeedPlan respects session override", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.growth_consultation;
    const disabled = prepareSandboxSeedPlan(template, { ...SAMPLE_INPUT, sandboxSeedEnabled: false });
    assert.equal(disabled.enabled, false);
    assert.ok(disabled.items.every((i) => !i.included));

    const enabled = prepareSandboxSeedPlan(template);
    assert.equal(enabled.enabled, true);
    assert.ok(enabled.items.some((i) => i.kind === "demo_patients" && i.included));
    assert.ok(enabled.items.some((i) => i.kind === "demo_bookings" && !i.included));
  });

  it("buildClinicDeploymentPlan resolves full session deployment snapshot", () => {
    const plan = buildClinicDeploymentPlan(SAMPLE_INPUT);
    assert.equal(plan.templateCode, "surgical_hair_restoration");
    assert.ok(plan.moduleBundle.enabledModules.includes("surgery_os"));
    assert.ok(plan.serviceTemplates.length >= 4);
    assert.ok(plan.academyAssignments.length >= 2);
  });
});

describe("OnboardingOS Phase A — migration", () => {
  it("defines provisioning tables with service_role RLS", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260622120000_onboarding_os_tenant_provisioning_engine.sql"),
      "utf8"
    );
    assert.match(sql, /fi_tenant_provisioning_sessions/);
    assert.match(sql, /fi_tenant_provisioning_steps/);
    assert.match(sql, /fi_tenant_provisioning_audit_events/);
    assert.match(sql, /fi_tenant_provisioning_templates/);
    assert.match(sql, /grant select, insert, update, delete on public\.fi_tenant_provisioning_sessions to service_role/);
    assert.match(sql, /idx_fi_tenant_provisioning_sessions_tenant_id/);
    assert.match(sql, /idx_fi_tenant_provisioning_steps_session_id/);
  });
});

describe("OnboardingOS Phase B — migration", () => {
  it("adds deployment_template column and seeds clinic templates", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260922120006_onboarding_os_phase_b_clinic_deployment_templates.sql"),
      "utf8"
    );
    assert.match(sql, /deployment_template/);
    assert.match(sql, /deployment_snapshot/);
    assert.match(sql, /standard_hair_restoration/);
    assert.match(sql, /surgical_hair_restoration/);
    assert.match(sql, /growth_consultation/);
    assert.match(sql, /enterprise_multi_clinic/);
  });
});
