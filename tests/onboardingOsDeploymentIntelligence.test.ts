import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildDeploymentIntelligenceDomains,
  buildDeploymentIntelligenceSnapshot,
  calculateDeploymentScore,
  generateDeploymentIntelligenceRecommendations,
  inferCountryLabelFromTimezone,
  isProductionReadyScore,
  mapGoLiveReadinessToExecutiveApproval,
  mapGuidedAssistSummaryToAdoptionConfidence,
  resolveDeploymentStatus,
} from "../src/lib/onboarding-os/deploymentIntelligenceCore";
import type { DeploymentIntelligenceInputSignals } from "../src/lib/onboarding-os/deploymentIntelligenceCore";
import { buildGoLiveReadinessSnapshot } from "../src/lib/onboarding-os/goLiveReadinessCore";
import type { GoLiveReadinessInputSignals } from "../src/lib/onboarding-os/goLiveReadinessCore";
import type { GoLiveReadinessReviewStatus } from "../src/lib/onboarding-os/goLiveReadinessTypes";
import { DEPLOYMENT_INTELLIGENCE_DOMAIN_WEIGHTS } from "../src/lib/onboarding-os/deploymentIntelligenceTypes";

const GENERATED_AT = "2026-06-22T12:00:00.000Z";
const SESSION_ID = "00000000-0000-4000-8000-000000000010";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const BASE_REVIEWS: GoLiveReadinessReviewStatus = {
  ownerReviewComplete: false,
  ownerReviewedAt: null,
  ownerReviewerLabel: null,
  platformReviewComplete: false,
  platformReviewedAt: null,
  platformReviewerLabel: null,
  goLiveApproved: false,
  goLiveApprovedAt: null,
};

function makeGoLiveSignals(overrides: Partial<GoLiveReadinessInputSignals> = {}): GoLiveReadinessInputSignals {
  return {
    sessionId: SESSION_ID,
    tenantId: TENANT_ID,
    tenantName: "Demo Clinic",
    tenantSlug: "demo-clinic",
    stepStatuses: {
      provision_tenant_core: "completed",
      apply_module_entitlements: "completed",
      deploy_clinic_configuration: "completed",
      assign_academy_training: "completed",
      prepare_sandbox_seed: "completed",
    },
    deploymentPlan: {
      templateCode: "standard_hair_restoration",
      templateDisplayName: "Standard Hair Restoration",
      rolePack: {
        code: "standard_clinic_roles",
        displayName: "Standard",
        primaryAdminRole: "clinic_admin",
        additionalRoles: [],
      },
      moduleBundle: {
        code: "core_clinic",
        displayName: "Core",
        subscriptionStatus: "trialing",
        verificationStatus: "verified",
        enabledModules: ["reception_os", "consultation_os"],
      },
      serviceTemplates: [
        { code: "consult", name: "Consult", bookingType: "consultation", durationMinutes: 30, category: "consult" },
      ],
      workflowTemplates: [{ code: "wf1", name: "Booking", type: "booking_workflow", config: {} }],
      academyAssignments: [{ trackCode: "t1", trackName: "Track 1", targetRoles: ["clinic_admin"], mandatory: true }],
      sandboxSeed: { enabled: false, includeDemoPatients: false, includeDemoBookings: false, includeDemoStaff: false },
    },
    sandboxSeedEnabled: false,
    sandboxSeedHistoryLength: 0,
    clinicCount: 1,
    enabledModuleCount: 2,
    expectedModuleCount: 2,
    serviceCount: 1,
    expectedServiceCount: 1,
    staffUserCount: 3,
    adminRoleAssignedCount: 2,
    guidedAssistConfigured: true,
    reviews: {
      ...BASE_REVIEWS,
      ownerReviewComplete: true,
      platformReviewComplete: true,
    },
    checklistReviewedCodes: [],
    generatedAt: GENERATED_AT,
    ...overrides,
  };
}

function makeDeploymentSignals(overrides: Partial<DeploymentIntelligenceInputSignals> = {}): DeploymentIntelligenceInputSignals {
  const goLive = buildGoLiveReadinessSnapshot(makeGoLiveSignals());
  return {
    sessionId: SESSION_ID,
    tenantId: TENANT_ID,
    tenantName: "Demo Clinic",
    tenantSlug: "demo-clinic",
    countryLabel: "Australia",
    provisioningStatus: "in_progress",
    provisioningProgressPercent: 85,
    sandboxSeedEnabled: false,
    sandboxSeedApplied: false,
    goLiveReadiness: goLive,
    guidedAssistAdoption: {
      guidedAssistConfigured: true,
      totalEvents: 20,
      uniqueUsers: 3,
      tipsShown: 15,
      tipsDismissed: 3,
      nextActionsClicked: 4,
      modulesNeedingGuidanceReviewCount: 0,
    },
    connectorAuthReadiness: {
      registeredCount: 0,
      verifiedCount: 0,
      unverifiedCount: 0,
      failedCount: 0,
      avgPermissionCoverage: 0,
    },
    calculatedAt: GENERATED_AT,
    ...overrides,
  };
}

describe("OnboardingOS Phase E2 — deployment intelligence core", () => {
  it("calculateDeploymentScore applies domain weights totalling 100", () => {
    const domains = buildDeploymentIntelligenceDomains(makeDeploymentSignals());
    const breakdown = calculateDeploymentScore(domains);
    const weightSum = Object.values(DEPLOYMENT_INTELLIGENCE_DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(weightSum, 100);
    assert.equal(breakdown.totalWeight, 100);
    assert.ok(breakdown.overallScore >= 0 && breakdown.overallScore <= 100);
    assert.equal(
      breakdown.overallScore,
      domains.reduce((sum, d) => sum + d.weightedContribution, 0)
    );
  });

  it("operational readiness reaches 100% when all four scoring conditions pass", () => {
    const domains = buildDeploymentIntelligenceDomains(
      makeDeploymentSignals({
        provisioningProgressPercent: 85,
        sandboxSeedEnabled: false,
        sandboxSeedApplied: false,
        guidedAssistAdoption: {
          guidedAssistConfigured: true,
          totalEvents: 10,
          uniqueUsers: 2,
          tipsShown: 5,
          tipsDismissed: 1,
          nextActionsClicked: 2,
          modulesNeedingGuidanceReviewCount: 0,
        },
      })
    );
    const operational = domains.find((d) => d.domain === "operational_readiness");
    assert.equal(operational?.scorePercent, 100);
  });

  it("resolveDeploymentStatus maps score bands correctly", () => {
    assert.equal(resolveDeploymentStatus(20), "early_setup");
    assert.equal(resolveDeploymentStatus(40), "infrastructure_in_progress");
    assert.equal(resolveDeploymentStatus(60), "internal_testing");
    assert.equal(resolveDeploymentStatus(80), "staff_training_active");
    assert.equal(resolveDeploymentStatus(90), "pilot_ready");
    assert.equal(resolveDeploymentStatus(98), "production_ready");
  });

  it("mapGoLiveReadinessToExecutiveApproval reflects reviews and approval gate", () => {
    const pending = mapGoLiveReadinessToExecutiveApproval(
      buildGoLiveReadinessSnapshot(makeGoLiveSignals({ reviews: { ...BASE_REVIEWS } }))
    );
    assert.ok(pending.scorePercent < 100);
    assert.ok(pending.blockers.some((b) => /review/i.test(b)));

    const approved = mapGoLiveReadinessToExecutiveApproval(
      buildGoLiveReadinessSnapshot(
        makeGoLiveSignals({
          reviews: {
            ...BASE_REVIEWS,
            ownerReviewComplete: true,
            platformReviewComplete: true,
            goLiveApproved: true,
            goLiveApprovedAt: GENERATED_AT,
          },
        })
      )
    );
    assert.equal(approved.scorePercent, 100);
    assert.match(approved.summary, /approved/i);
  });

  it("mapGuidedAssistSummaryToAdoptionConfidence scales with usage signals", () => {
    const low = mapGuidedAssistSummaryToAdoptionConfidence({
      guidedAssistConfigured: false,
      totalEvents: 0,
      uniqueUsers: 0,
      tipsShown: 0,
      tipsDismissed: 0,
      nextActionsClicked: 0,
      modulesNeedingGuidanceReviewCount: 0,
    });
    assert.equal(low.scorePercent, 10);

    const high = mapGuidedAssistSummaryToAdoptionConfidence({
      guidedAssistConfigured: true,
      totalEvents: 50,
      uniqueUsers: 4,
      tipsShown: 30,
      tipsDismissed: 5,
      nextActionsClicked: 8,
      modulesNeedingGuidanceReviewCount: 0,
    });
    assert.ok(high.scorePercent >= 75);
  });

  it("generateDeploymentIntelligenceRecommendations includes domain and go-live blockers", () => {
    const goLive = buildGoLiveReadinessSnapshot(
      makeGoLiveSignals({ clinicCount: 0, tenantId: null, stepStatuses: {} })
    );
    const domains = buildDeploymentIntelligenceDomains(
      makeDeploymentSignals({ goLiveReadiness: goLive, provisioningProgressPercent: 10 })
    );
    const recs = generateDeploymentIntelligenceRecommendations(domains, goLive);
    assert.ok(recs.some((r) => r.severity === "blocker"));
    assert.ok(recs.some((r) => r.domain === "executive_approval" || r.code.startsWith("go_live_")));
  });

  it("isProductionReadyScore requires 96+ threshold", () => {
    assert.equal(isProductionReadyScore(95), false);
    assert.equal(isProductionReadyScore(96), true);
    assert.equal(isProductionReadyScore(100), true);
  });

  it("buildDeploymentIntelligenceSnapshot embeds go-live readiness without replacing it", () => {
    const snapshot = buildDeploymentIntelligenceSnapshot(makeDeploymentSignals());
    assert.equal(snapshot.goLiveReadiness.sessionId, SESSION_ID);
    assert.ok(snapshot.scoreBreakdown.domainScores.length === 6);
    assert.equal(snapshot.adoptionConfidenceScore, snapshot.scoreBreakdown.domainScores.find((d) => d.domain === "adoption_confidence")?.scorePercent);
  });

  it("inferCountryLabelFromTimezone extracts region from IANA timezone", () => {
    assert.equal(inferCountryLabelFromTimezone("Australia/Sydney"), "Australia");
    assert.equal(inferCountryLabelFromTimezone(""), "—");
  });
});

describe("OnboardingOS Phase E2 — migration", () => {
  it("defines fi_tenant_deployment_intelligence_snapshots with RLS and indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120009_onboarding_os_phase_e2_deployment_intelligence.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /create table if not exists public\.fi_tenant_deployment_intelligence_snapshots/);
    assert.match(sql, /deployment_score/);
    assert.match(sql, /domain_scores jsonb/);
    assert.match(sql, /source_snapshot jsonb/);
    assert.match(sql, /idx_fi_tenant_deployment_intel_tenant/);
    assert.match(sql, /idx_fi_tenant_deployment_intel_session/);
    assert.match(sql, /idx_fi_tenant_deployment_intel_status/);
    assert.match(sql, /idx_fi_tenant_deployment_intel_calculated_at/);
    assert.match(sql, /fi_tenant_deployment_intel_select_platform_admin/);
    assert.match(sql, /fi_tenant_deployment_intel_select_tenant_admin/);
    assert.match(sql, /grant insert, update, delete on public\.fi_tenant_deployment_intelligence_snapshots to service_role/);
  });
});
