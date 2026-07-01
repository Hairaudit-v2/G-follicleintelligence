import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAttentionQueue,
  buildCommandCentreKpis,
  buildEmptyPlanningFallbackMessage,
  buildModuleTiles,
  buildProcedureStaffingForecast,
  formatModuleTileMetric,
  healthStatusLabel,
  scoreToHealthStatus,
  sortAttentionQueue,
} from "@/src/lib/workforce/workforceCommandCentreCore";
import type { WorkforceAttentionQueueItem } from "@/src/lib/workforce/workforceCommandCentreCore";
import { buildWorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";

const baseCompose = {
  tenantId: "tenant-1",
  totalStaff: 20,
  operationalMetrics: {
    syncHealthPercent: 85,
    openDuplicateCount: 2,
    unlinkedStaffCount: 3,
    inactiveStaffCount: 1,
    offboardingQueueCount: 1,
    clinicallyEligibleStaff: 16,
    expiringCredentials: 2,
    complianceAlerts: 1,
    expiredCertifications: 1,
  },
  planning: null as ReturnType<typeof buildWorkforcePlanningSnapshot> | null,
  shiftCost: null,
  openRecruitmentCount: 4,
  activeRecruitmentPipelineCount: 6,
  missingWageProfileCount: 3,
  wageProfileCoveragePercent: 85,
};

describe("workforceCommandCentreCore", () => {
  it("scoreToHealthStatus maps thresholds", () => {
    assert.equal(scoreToHealthStatus(95), "excellent");
    assert.equal(scoreToHealthStatus(80), "good");
    assert.equal(scoreToHealthStatus(60), "attention");
    assert.equal(scoreToHealthStatus(30), "critical");
    assert.equal(scoreToHealthStatus(null), "unknown");
  });

  it("buildCommandCentreKpis uses operational fallbacks when planning missing", () => {
    const kpis = buildCommandCentreKpis(baseCompose);
    assert.equal(kpis.totalStaff, 20);
    assert.equal(kpis.clinicallyEligible, 16);
    assert.equal(kpis.openRecruitment, 4);
    assert.equal(kpis.credentialRisks, 4);
    assert.equal(kpis.upcomingProcedureGaps, 0);
  });

  it("buildProcedureStaffingForecast returns safe fallback when planning missing", () => {
    const forecast = buildProcedureStaffingForecast(null);
    assert.equal(forecast.available, false);
    assert.equal(forecast.scheduledProcedures, 0);
    assert.deepEqual(forecast.missingRoles, []);
  });

  it("sortAttentionQueue prioritizes by score and dedupes ids", () => {
    const items: WorkforceAttentionQueueItem[] = [
      {
        id: "a",
        severity: "low",
        title: "Low",
        explanation: "",
        recommendedAction: "",
        href: "/a",
        score: 100,
      },
      {
        id: "b",
        severity: "critical",
        title: "Critical",
        explanation: "",
        recommendedAction: "",
        href: "/b",
        score: 900,
      },
      {
        id: "a",
        severity: "high",
        title: "Dup",
        explanation: "",
        recommendedAction: "",
        href: "/a2",
        score: 500,
      },
    ];
    const sorted = sortAttentionQueue(items, 5);
    assert.equal(sorted[0]?.id, "b");
    assert.equal(sorted.length, 2);
  });

  it("buildAttentionQueue merges planning and operational items", () => {
    const planning = buildWorkforcePlanningSnapshot({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-14",
      staffingShortages: [{ role: "nurse", shortageCount: 2, affectedDates: ["2026-07-02"], confidence: 80, reason: "Gap" }],
      credentialRisks: [],
      recruitmentForecast: {
        activePipelineCount: 2,
        lateStageCount: 0,
        openRoleRequirementCount: 1,
        recommendedHires: 2,
        pipelineCoveragePercent: 0,
        reason: "Need hires",
      },
      procedureCapacity: {
        horizonDays: 14,
        scheduledProcedures: 5,
        fullyStaffedProcedures: 3,
        understaffedProcedures: 2,
        capacityUtilizationPercent: 60,
        estimatedMaxProcedures: 4,
      },
      weeklyWageExposureCents: 1_840_000,
      missingWageProfileCount: 3,
    });

    const queue = buildAttentionQueue({ ...baseCompose, planning });
    assert.ok(queue.length >= 3);
    assert.ok(queue.some((q) => q.id === "missing-wage-profiles" || q.id === "complete-wage-profiles"));
  });

  it("buildModuleTiles formats payroll metric with currency", () => {
    const planning = buildWorkforcePlanningSnapshot({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-14",
      staffingShortages: [],
      credentialRisks: [],
      recruitmentForecast: {
        activePipelineCount: 0,
        lateStageCount: 0,
        openRoleRequirementCount: 0,
        recommendedHires: 0,
        pipelineCoveragePercent: 100,
        reason: "OK",
      },
      procedureCapacity: {
        horizonDays: 14,
        scheduledProcedures: 0,
        fullyStaffedProcedures: 0,
        understaffedProcedures: 0,
        capacityUtilizationPercent: 100,
        estimatedMaxProcedures: 0,
      },
      weeklyWageExposureCents: 1_840_000,
      missingWageProfileCount: 3,
    });
    const tiles = buildModuleTiles({ ...baseCompose, planning });
    const payroll = tiles.find((t) => t.id === "payroll");
    assert.ok(payroll?.keyMetric.includes("Weekly exposure"));
    assert.equal(payroll?.statusBadge.variant, "warning");
  });

  it("formatModuleTileMetric and healthStatusLabel handle empty values", () => {
    assert.equal(formatModuleTileMetric(""), "—");
    assert.equal(healthStatusLabel("unknown"), "No data");
    assert.ok(buildEmptyPlanningFallbackMessage().includes("Refresh"));
  });
});