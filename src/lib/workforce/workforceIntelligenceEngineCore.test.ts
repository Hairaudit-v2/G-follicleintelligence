import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExecutiveRecommendations,
  buildOverallWorkforceHealthScore,
  buildPredictiveStaffingForecast,
  buildTomorrowSurgeryReadiness,
  clampIntelligenceScore,
  composeWorkforceIntelligence,
  scoreToIntelligenceStatus,
} from "@/src/lib/workforce/workforceIntelligenceEngineCore";
import type { WorkforceCommandCentreComposeInput } from "@/src/lib/workforce/workforceCommandCentreCore";
import { buildWorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";

function cleanPlanning() {
  return buildWorkforcePlanningSnapshot({
    tenantId: "tenant-1",
    horizonStart: "2026-07-01",
    horizonEnd: "2026-07-14",
    staffingShortages: [],
    credentialRisks: [],
    recruitmentForecast: {
      activePipelineCount: 4,
      lateStageCount: 2,
      openRoleRequirementCount: 0,
      recommendedHires: 0,
      pipelineCoveragePercent: 100,
      reason: "Pipeline covers forecast gaps.",
    },
    procedureCapacity: {
      horizonDays: 14,
      scheduledProcedures: 8,
      fullyStaffedProcedures: 8,
      understaffedProcedures: 0,
      capacityUtilizationPercent: 100,
      estimatedMaxProcedures: 8,
    },
    weeklyWageExposureCents: 1_200_000,
    missingWageProfileCount: 0,
  });
}

const cleanCompose: WorkforceCommandCentreComposeInput = {
  tenantId: "tenant-1",
  totalStaff: 20,
  operationalMetrics: {
    syncHealthPercent: 100,
    openDuplicateCount: 0,
    unlinkedStaffCount: 0,
    inactiveStaffCount: 0,
    offboardingQueueCount: 0,
    clinicallyEligibleStaff: 19,
    expiringCredentials: 0,
    complianceAlerts: 0,
    expiredCertifications: 0,
  },
  planning: cleanPlanning(),
  shiftCost: null,
  openRecruitmentCount: 0,
  activeRecruitmentPipelineCount: 4,
  missingWageProfileCount: 0,
  wageProfileCoveragePercent: 100,
};

describe("workforceIntelligenceEngineCore", () => {
  it("clampIntelligenceScore clamps and handles invalid values", () => {
    assert.equal(clampIntelligenceScore(120), 100);
    assert.equal(clampIntelligenceScore(-5), 0);
    assert.equal(clampIntelligenceScore(72.6), 73);
    assert.equal(clampIntelligenceScore(Number.NaN), 0);
    assert.equal(clampIntelligenceScore(Number.POSITIVE_INFINITY), 0);
  });

  it("scoreToIntelligenceStatus maps thresholds", () => {
    assert.equal(scoreToIntelligenceStatus(95), "excellent");
    assert.equal(scoreToIntelligenceStatus(80), "stable");
    assert.equal(scoreToIntelligenceStatus(60), "watch");
    assert.equal(scoreToIntelligenceStatus(30), "critical");
  });

  it("buildOverallWorkforceHealthScore is excellent when all signals are clean", () => {
    const health = buildOverallWorkforceHealthScore(cleanCompose);
    assert.ok(health.score >= 90);
    assert.equal(health.status, "excellent");
    assert.equal(health.contributingFactors.length, 0);
    assert.ok(health.summary.includes("strong"));
    assert.ok(Number.isFinite(health.score));
  });

  it("buildOverallWorkforceHealthScore is critical with wage, HR, and duplicate gaps", () => {
    const health = buildOverallWorkforceHealthScore({
      ...cleanCompose,
      planning: null,
      missingWageProfileCount: 8,
      wageProfileCoveragePercent: 60,
      operationalMetrics: {
        ...cleanCompose.operationalMetrics!,
        unlinkedStaffCount: 6,
        openDuplicateCount: 4,
        clinicallyEligibleStaff: 8,
        expiringCredentials: 3,
        expiredCertifications: 2,
        complianceAlerts: 2,
      },
    });
    assert.ok(health.score < 50);
    assert.equal(health.status, "critical");
    assert.ok(health.contributingFactors.some((f) => f.label.includes("wage")));
    assert.ok(health.contributingFactors.some((f) => f.label.includes("HR")));
    assert.ok(health.contributingFactors.some((f) => f.label.includes("Duplicate")));
    assert.ok(health.score >= 0 && health.score <= 100);
  });

  it("buildTomorrowSurgeryReadiness returns empty state when no tomorrow risks", () => {
    const readiness = buildTomorrowSurgeryReadiness(cleanCompose);
    assert.equal(readiness.summary, "No procedure staffing risks detected for tomorrow.");
    assert.equal(readiness.understaffed, 0);
    assert.equal(readiness.credentialWarnings, 0);
    assert.equal(readiness.readinessScore, 100);
    assert.equal(readiness.status, "excellent");
    assert.deepEqual(readiness.actions, []);
  });

  it("buildTomorrowSurgeryReadiness returns empty state when planning is absent", () => {
    const readiness = buildTomorrowSurgeryReadiness({ ...cleanCompose, planning: null });
    assert.equal(readiness.summary, "No procedure staffing risks detected for tomorrow.");
    assert.equal(readiness.available, false);
  });

  it("buildTomorrowSurgeryReadiness surfaces tomorrow staffing gaps from planning", () => {
    const planning = buildWorkforcePlanningSnapshot({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-14",
      staffingShortages: [
        {
          role: "nurse",
          shortageCount: 2,
          affectedDates: ["2026-07-02"],
          confidence: 85,
          reason: "Understaffed on 1 day(s) in planning horizon.",
        },
      ],
      credentialRisks: [],
      recruitmentForecast: cleanPlanning().recruitmentForecast,
      procedureCapacity: cleanPlanning().procedureCapacity,
      weeklyWageExposureCents: 1_200_000,
      missingWageProfileCount: 0,
    });

    const readiness = buildTomorrowSurgeryReadiness({ ...cleanCompose, planning });
    assert.equal(readiness.understaffed, 1);
    assert.ok(readiness.summary.includes("staffing gap"));
    assert.ok(readiness.actions.length > 0);
    assert.ok(readiness.readinessScore < 100);
  });

  it("buildPredictiveStaffingForecast returns safe fallback when planning is absent", () => {
    const forecast = buildPredictiveStaffingForecast({ ...cleanCompose, planning: null });
    assert.equal(forecast.sevenDayScore, 75);
    assert.equal(forecast.fourteenDayScore, 75);
    assert.deepEqual(forecast.upcomingRisks, []);
    assert.ok(forecast.summary.includes("unavailable"));
    assert.ok(forecast.sevenDayScore >= 0 && forecast.sevenDayScore <= 100);
  });

  it("buildExecutiveRecommendations ranks higher-urgency items first", () => {
    const planning = buildWorkforcePlanningSnapshot({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-14",
      staffingShortages: [{ role: "nurse", shortageCount: 3, affectedDates: ["2026-07-03"], confidence: 80, reason: "Gap" }],
      credentialRisks: [],
      recruitmentForecast: {
        activePipelineCount: 1,
        lateStageCount: 0,
        openRoleRequirementCount: 2,
        recommendedHires: 2,
        pipelineCoveragePercent: 0,
        reason: "Need hires",
      },
      procedureCapacity: {
        horizonDays: 14,
        scheduledProcedures: 5,
        fullyStaffedProcedures: 2,
        understaffedProcedures: 3,
        capacityUtilizationPercent: 40,
        estimatedMaxProcedures: 4,
      },
      weeklyWageExposureCents: 2_000_000,
      missingWageProfileCount: 4,
    });

    const recs = buildExecutiveRecommendations({
      ...cleanCompose,
      planning,
      missingWageProfileCount: 4,
      openRecruitmentCount: 2,
      operationalMetrics: {
        ...cleanCompose.operationalMetrics!,
        unlinkedStaffCount: 3,
        openDuplicateCount: 2,
      },
    });

    assert.ok(recs.length >= 3);
    assert.ok(recs[0]!.score >= recs[1]!.score);
    assert.ok(recs.some((r) => r.title.includes("wage profiles")));
    assert.ok(recs.some((r) => r.title.includes("HR identities")));
    assert.ok(recs.some((r) => r.title.includes("understaffed")));
  });

  it("composeWorkforceIntelligence returns top recommendations without NaN scores", () => {
    const panel = composeWorkforceIntelligence({
      ...cleanCompose,
      missingWageProfileCount: 2,
      operationalMetrics: {
        ...cleanCompose.operationalMetrics!,
        unlinkedStaffCount: 1,
      },
    });

    assert.ok(Number.isFinite(panel.overallHealth.score));
    assert.ok(Number.isFinite(panel.tomorrowReadiness.readinessScore));
    assert.ok(Number.isFinite(panel.forecast.sevenDayScore));
    assert.ok(Number.isFinite(panel.forecast.fourteenDayScore));
    assert.ok(panel.executiveRecommendations.length <= 6);
    assert.ok(
      panel.executiveRecommendations.every(
        (r) => r.route.startsWith("/fi-admin/") && r.ctaLabel.length > 0
      )
    );
  });
});