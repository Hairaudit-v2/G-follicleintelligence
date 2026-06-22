import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildGoLiveApprovalEventDetail,
  buildGoLiveReadinessChecks,
  buildGoLiveReadinessSnapshot,
  calculateGoLiveReadinessScore,
  canPlatformAdminApproveGoLive,
  generateGoLiveRecommendations,
  resolveGoLiveReadinessStatus,
} from "../src/lib/onboarding-os/goLiveReadinessCore";
import type { GoLiveReadinessReviewStatus } from "../src/lib/onboarding-os/goLiveReadinessTypes";
import type { GoLiveReadinessInputSignals } from "../src/lib/onboarding-os/goLiveReadinessCore";

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

function makeSignals(overrides: Partial<GoLiveReadinessInputSignals> = {}): GoLiveReadinessInputSignals {
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
      serviceTemplates: [{ code: "consult", name: "Consult", bookingType: "consultation", durationMinutes: 30, category: "consult" }],
      workflowTemplates: [{ code: "wf1", name: "Booking", type: "booking_workflow", config: {} }],
      academyAssignments: [{ trackCode: "t1", trackName: "Track 1", targetRoles: ["clinic_admin"], mandatory: true }],
      sandboxSeed: { enabled: true, includeDemoPatients: true, includeDemoBookings: true, includeDemoStaff: true },
    },
    sandboxSeedEnabled: true,
    sandboxSeedHistoryLength: 1,
    clinicCount: 1,
    enabledModuleCount: 2,
    expectedModuleCount: 2,
    serviceCount: 1,
    expectedServiceCount: 1,
    staffUserCount: 3,
    adminRoleAssignedCount: 2,
    guidedAssistConfigured: true,
    reviews: { ...BASE_REVIEWS },
    checklistReviewedCodes: [],
    generatedAt: GENERATED_AT,
    ...overrides,
  };
}

describe("OnboardingOS Phase E — go-live readiness core", () => {
  it("calculateGoLiveReadinessScore counts required and optional checks", () => {
    const checks = buildGoLiveReadinessChecks(makeSignals());
    const score = calculateGoLiveReadinessScore(checks);
    assert.ok(score.percent >= 0 && score.percent <= 100);
    assert.equal(score.requiredTotal, 9);
    assert.ok(score.optionalTotal >= 2);
  });

  it("resolveGoLiveReadinessStatus is blocked when critical checks fail", () => {
    const signals = makeSignals({
      tenantId: null,
      stepStatuses: {},
      clinicCount: 0,
    });
    const snapshot = buildGoLiveReadinessSnapshot(signals);
    assert.equal(snapshot.status, "blocked");
    assert.ok(snapshot.checks.some((c) => c.code === "tenant_shell_provisioned" && c.state === "fail"));
  });

  it("resolveGoLiveReadinessStatus is warning when optional checks fail", () => {
    const signals = makeSignals({
      guidedAssistConfigured: false,
      sandboxSeedHistoryLength: 0,
      stepStatuses: {
        ...makeSignals().stepStatuses,
        prepare_sandbox_seed: "pending",
      },
      reviews: {
        ...BASE_REVIEWS,
        ownerReviewComplete: true,
        platformReviewComplete: true,
      },
    });
    const snapshot = buildGoLiveReadinessSnapshot(signals);
    assert.equal(snapshot.status, "warning");
    assert.ok(snapshot.checks.some((c) => c.severity === "optional" && c.state === "fail"));
  });

  it("resolveGoLiveReadinessStatus is ready when all required checks pass", () => {
    const signals = makeSignals({
      sandboxSeedEnabled: false,
      guidedAssistConfigured: true,
      deploymentPlan: {
        ...makeSignals().deploymentPlan!,
        sandboxSeed: { enabled: false, includeDemoPatients: false, includeDemoBookings: false, includeDemoStaff: false },
        workflowTemplates: [],
        academyAssignments: [],
      },
      reviews: {
        ...BASE_REVIEWS,
        ownerReviewComplete: true,
        platformReviewComplete: true,
      },
    });
    const snapshot = buildGoLiveReadinessSnapshot(signals);
    assert.equal(snapshot.status, "ready");
    assert.equal(snapshot.score.requiredPassed, snapshot.score.requiredTotal);
  });

  it("generateGoLiveRecommendations surfaces blockers and review gaps", () => {
    const checks = buildGoLiveReadinessChecks(makeSignals({ clinicCount: 0 }));
    const recs = generateGoLiveRecommendations(checks, BASE_REVIEWS);
    assert.ok(recs.some((r) => r.severity === "blocker" && r.relatedCheckCode === "clinic_locations_created"));
    assert.ok(recs.some((r) => r.code === "complete_owner_review"));
    assert.ok(recs.some((r) => r.code === "complete_platform_review"));
  });

  it("canPlatformAdminApproveGoLive rejects tenant admins", () => {
    const snapshot = buildGoLiveReadinessSnapshot(
      makeSignals({
        reviews: {
          ...BASE_REVIEWS,
          ownerReviewComplete: true,
          platformReviewComplete: true,
        },
      })
    );
    const gate = canPlatformAdminApproveGoLive({ isPlatformAdmin: false, snapshot });
    assert.equal(gate.allowed, false);
    assert.match(gate.reason ?? "", /Platform administrator/i);
  });

  it("canPlatformAdminApproveGoLive allows platform admin when ready and reviews complete", () => {
    const snapshot = buildGoLiveReadinessSnapshot(
      makeSignals({
        sandboxSeedEnabled: false,
        deploymentPlan: {
          ...makeSignals().deploymentPlan!,
          sandboxSeed: { enabled: false, includeDemoPatients: false, includeDemoBookings: false, includeDemoStaff: false },
          workflowTemplates: [],
          academyAssignments: [],
        },
        reviews: {
          ...BASE_REVIEWS,
          ownerReviewComplete: true,
          platformReviewComplete: true,
        },
      })
    );
    assert.equal(snapshot.status, "ready");
    const gate = canPlatformAdminApproveGoLive({ isPlatformAdmin: true, snapshot });
    assert.equal(gate.allowed, true);
  });

  it("buildGoLiveApprovalEventDetail includes safety flags and score metadata", () => {
    const snapshot = buildGoLiveReadinessSnapshot(makeSignals());
    const detail = buildGoLiveApprovalEventDetail(snapshot);
    assert.equal(detail.session_id, SESSION_ID);
    assert.equal(detail.tenant_id, TENANT_ID);
    assert.equal(typeof detail.readiness_score_percent, "number");
    assert.deepEqual(detail.safety, {
      billing_activation: false,
      crm_import: false,
      sandbox_cleanup: false,
    });
  });
});

describe("OnboardingOS Phase E — approval gate", () => {
  it("tenant admin role cannot pass platform approval gate", () => {
    const snapshot = buildGoLiveReadinessSnapshot(
      makeSignals({
        reviews: {
          ...BASE_REVIEWS,
          ownerReviewComplete: true,
          platformReviewComplete: true,
        },
      })
    );
    assert.equal(canPlatformAdminApproveGoLive({ isPlatformAdmin: false, snapshot }).allowed, false);
  });
});

describe("OnboardingOS Phase E — migration", () => {
  it("defines go-live readiness tables with tenant-safe RLS and indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120008_onboarding_os_phase_e_go_live_readiness.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /create table if not exists public\.fi_tenant_go_live_readiness_snapshots/);
    assert.match(sql, /create table if not exists public\.fi_tenant_go_live_readiness_reviews/);
    assert.match(sql, /create table if not exists public\.fi_tenant_go_live_approval_events/);
    assert.match(sql, /fi_tenant_go_live_snapshots_select_tenant_member/);
    assert.match(sql, /fi_tenant_go_live_reviews_select_tenant_member/);
    assert.match(sql, /fi_tenant_go_live_approval_events_select_tenant_member/);
    assert.match(sql, /idx_fi_tenant_go_live_snapshots_tenant/);
    assert.match(sql, /idx_fi_tenant_go_live_snapshots_session/);
    assert.match(sql, /idx_fi_tenant_go_live_snapshots_status/);
    assert.match(sql, /idx_fi_tenant_go_live_snapshots_created_at/);
    assert.match(sql, /go_live_approved/);
    assert.match(sql, /grant insert on public\.fi_tenant_go_live_approval_events to service_role/);
  });
});
