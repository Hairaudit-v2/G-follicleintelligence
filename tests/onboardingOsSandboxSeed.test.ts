import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CLINIC_DEPLOYMENT_TEMPLATES } from "../src/lib/onboarding-os/clinicDeploymentCatalog";
import {
  SANDBOX_SEED_PACKS,
  SANDBOX_SEED_SOURCE,
  listSandboxSeedPackSummaries,
} from "../src/lib/onboarding-os/sandboxSeedCatalog";
import {
  buildClinicDeploymentPlan,
  buildSandboxSeedPlan,
  buildSandboxSeedPreview,
  buildSandboxSeedRecordMetadata,
  calculateSandboxSeedSize,
  isSandboxSeedTenantLive,
  resolveSandboxSeedPack,
  validateSandboxSeedRequest,
} from "../src/lib/onboarding-os/tenantProvisioningCore";

const SESSION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TENANT_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const GENERATED_AT = "2026-06-01T00:00:00.000Z";

const SAMPLE_INPUT = {
  tenantName: "Sandbox Clinic",
  tenantSlug: "sandbox-clinic",
  defaultClinicDisplayName: "Sandbox Clinic HQ",
  defaultTimezone: "Australia/Perth",
  firstTenantAdminEmail: "admin@sandbox-clinic.test",
  deploymentTemplateCode: "surgical_hair_restoration" as const,
  sandboxSeedEnabled: true,
};

describe("OnboardingOS Phase C — sandbox seed catalog", () => {
  it("lists three deterministic seed packs", () => {
    const summaries = listSandboxSeedPackSummaries();
    assert.equal(summaries.length, 3);
    assert.ok(summaries.some((s) => s.code === "light_demo"));
    assert.ok(summaries.some((s) => s.code === "standard_demo"));
    assert.ok(summaries.some((s) => s.code === "enterprise_demo"));
  });

  it("resolveSandboxSeedPack uses explicit code or template default", () => {
    assert.equal(resolveSandboxSeedPack("growth_consultation")?.code, "light_demo");
    assert.equal(resolveSandboxSeedPack("enterprise_multi_clinic")?.code, "enterprise_demo");
    assert.equal(resolveSandboxSeedPack("surgical_hair_restoration", "enterprise_demo")?.code, "enterprise_demo");
  });

  it("calculateSandboxSeedSize respects module entitlements", () => {
    const pack = SANDBOX_SEED_PACKS.standard_demo;
    const surgicalPlan = buildClinicDeploymentPlan(SAMPLE_INPUT);
    const growthPlan = buildClinicDeploymentPlan({
      ...SAMPLE_INPUT,
      deploymentTemplateCode: "growth_consultation",
    });

    assert.ok(calculateSandboxSeedSize(pack, surgicalPlan) > calculateSandboxSeedSize(pack, growthPlan));
  });
});

describe("OnboardingOS Phase C — sandbox seed plan + preview", () => {
  it("buildSandboxSeedPlan produces deterministic preview counts", () => {
    const deploymentPlan = buildClinicDeploymentPlan(SAMPLE_INPUT);
    const planA = buildSandboxSeedPlan({
      sessionId: SESSION_ID,
      tenantId: TENANT_ID,
      tenantSlug: "sandbox-clinic",
      templateCode: deploymentPlan.templateCode,
      deploymentPlan,
      packCode: "standard_demo",
      generatedAt: GENERATED_AT,
    });
    const planB = buildSandboxSeedPlan({
      sessionId: SESSION_ID,
      tenantId: TENANT_ID,
      tenantSlug: "sandbox-clinic",
      templateCode: deploymentPlan.templateCode,
      deploymentPlan,
      packCode: "standard_demo",
      generatedAt: GENERATED_AT,
    });

    assert.ok(planA);
    assert.deepEqual(planA, planB);
    assert.equal(planA?.packCode, "standard_demo");
    assert.ok(planA!.totalRecords > 0);
    assert.ok(planA!.entities.some((e) => e.entityType === "patients" && e.included));
    assert.ok(planA!.entities.some((e) => e.entityType === "surgeries" && e.included));
  });

  it("buildSandboxSeedPreview reflects included entity rows", () => {
    const deploymentPlan = buildClinicDeploymentPlan(SAMPLE_INPUT);
    const plan = buildSandboxSeedPlan({
      sessionId: SESSION_ID,
      tenantId: TENANT_ID,
      tenantSlug: "sandbox-clinic",
      templateCode: deploymentPlan.templateCode,
      deploymentPlan,
      packCode: "light_demo",
      generatedAt: GENERATED_AT,
    });
    assert.ok(plan);

    const preview = buildSandboxSeedPreview({ plan: plan! });
    assert.equal(preview.alreadyApplied, false);
    assert.equal(preview.plan.totalRecords, plan!.totalRecords);
  });

  it("buildSandboxSeedRecordMetadata stamps demo_data, source, and session metadata", () => {
    const metadata = buildSandboxSeedRecordMetadata({
      seedPack: "standard_demo",
      sessionId: SESSION_ID,
      generatedAt: GENERATED_AT,
      entityKey: "standard_demo:patients:001",
      entityType: "patients",
    });

    assert.equal(metadata.demo_data, true);
    assert.equal(metadata.source, SANDBOX_SEED_SOURCE);
    assert.equal(metadata.seed_pack, "standard_demo");
    assert.equal(metadata.session_id, SESSION_ID);
    assert.equal(metadata.generated_at, GENERATED_AT);
    assert.equal(metadata.sandbox_entity_key, "standard_demo:patients:001");
    assert.equal(metadata.entity_type, "patients");
  });
});

describe("OnboardingOS Phase C — sandbox seed guards", () => {
  it("validateSandboxSeedRequest rejects live tenant", () => {
    const deploymentPlan = buildClinicDeploymentPlan(SAMPLE_INPUT);
    const result = validateSandboxSeedRequest({
      request: { sessionId: SESSION_ID, packCode: "standard_demo" },
      sessionStatus: "completed",
      sandboxEnabled: true,
      tenantId: TENANT_ID,
      templateCode: deploymentPlan.templateCode,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "tenant_live");
    }
  });

  it("validateSandboxSeedRequest blocks duplicate apply unless force", () => {
    const deploymentPlan = buildClinicDeploymentPlan(SAMPLE_INPUT);
    const blocked = validateSandboxSeedRequest({
      request: { sessionId: SESSION_ID, packCode: "standard_demo" },
      sessionStatus: "in_progress",
      sandboxEnabled: true,
      tenantId: TENANT_ID,
      templateCode: deploymentPlan.templateCode,
      history: [
        {
          packCode: "standard_demo",
          appliedAt: GENERATED_AT,
          entityCounts: { patients: 12 },
          sessionId: SESSION_ID,
          seedFingerprint: "fp",
        },
      ],
    });

    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.errorCode, "already_applied");

    const forced = validateSandboxSeedRequest({
      request: { sessionId: SESSION_ID, packCode: "standard_demo", force: true },
      sessionStatus: "in_progress",
      sandboxEnabled: true,
      tenantId: TENANT_ID,
      templateCode: deploymentPlan.templateCode,
      history: [
        {
          packCode: "standard_demo",
          appliedAt: GENERATED_AT,
          entityCounts: { patients: 12 },
          sessionId: SESSION_ID,
          seedFingerprint: "fp",
        },
      ],
    });

    assert.equal(forced.ok, true);
  });

  it("validateSandboxSeedRequest rejects sandbox disabled sessions", () => {
    const deploymentPlan = buildClinicDeploymentPlan({ ...SAMPLE_INPUT, sandboxSeedEnabled: false });
    const result = validateSandboxSeedRequest({
      request: { sessionId: SESSION_ID },
      sessionStatus: "in_progress",
      sandboxEnabled: deploymentPlan.sandboxSeed.enabled,
      tenantId: TENANT_ID,
      templateCode: deploymentPlan.templateCode,
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, "sandbox_disabled");
  });

  it("isSandboxSeedTenantLive treats completed sessions and active billing as live", () => {
    assert.equal(isSandboxSeedTenantLive({ sessionStatus: "completed" }), true);
    assert.equal(
      isSandboxSeedTenantLive({ sessionStatus: "in_progress", tenantBillingStatus: "active" }),
      true
    );
    assert.equal(isSandboxSeedTenantLive({ sessionStatus: "in_progress" }), false);
  });
});

describe("OnboardingOS Phase C — template integration", () => {
  it("growth template default pack excludes surgeries when surgery_os disabled", () => {
    const template = CLINIC_DEPLOYMENT_TEMPLATES.growth_consultation;
    const plan = buildClinicDeploymentPlan({
      ...SAMPLE_INPUT,
      deploymentTemplateCode: "growth_consultation",
    });
    const seedPlan = buildSandboxSeedPlan({
      sessionId: SESSION_ID,
      tenantId: TENANT_ID,
      tenantSlug: "sandbox-clinic",
      templateCode: template.code,
      deploymentPlan: plan,
      generatedAt: GENERATED_AT,
    });

    assert.ok(seedPlan);
    const surgeries = seedPlan!.entities.find((e) => e.entityType === "surgeries");
    assert.equal(surgeries?.included, false);
  });
});
