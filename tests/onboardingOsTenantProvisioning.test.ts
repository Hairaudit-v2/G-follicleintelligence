import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildDefaultModuleTemplate,
  buildDefaultRoleTemplate,
  buildProvisioningAuditSnapshot,
  buildProvisioningSteps,
  buildTenantSlug,
  calculateProvisioningProgress,
  canRetryProvisioningStep,
  provisioningStepStatusAfterRetryRequest,
  validateProvisioningInput,
} from "../src/lib/onboarding-os/tenantProvisioningCore";

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
    assert.equal(progress.totalSteps, 7);
    assert.equal(progress.completedSteps, 3);
    assert.equal(progress.percent, 43);
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
    const result = validateProvisioningInput({
      tenantName: "Demo Clinic",
      tenantSlug: "demo-clinic",
      defaultClinicDisplayName: "Demo Clinic HQ",
      defaultTimezone: "Australia/Perth",
      firstTenantAdminEmail: "admin@demo-clinic.test",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.tenantSlug, "demo-clinic");
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
