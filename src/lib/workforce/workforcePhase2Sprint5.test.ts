import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWorkforcePlanningSnapshot,
  classifyCredentialRiskSeverity,
  forecastProcedureCapacity,
  forecastRecruitmentNeed,
  planningHorizonFromDate,
  predictStaffingShortages,
  rankNextBestWorkforceActions,
} from "@/src/lib/workforce/workforcePlanningEngineCore";

describe("workforcePlanningEngineCore", () => {
  it("planningHorizonFromDate spans 14 days", () => {
    const h = planningHorizonFromDate("2026-07-01");
    assert.equal(h.horizonStart, "2026-07-01");
    assert.equal(h.horizonEnd, "2026-07-14");
  });

  it("predictStaffingShortages aggregates role gaps by date", () => {
    const rows = predictStaffingShortages({
      understaffedByDate: [
        { workDate: "2026-07-01", missingRoles: [{ role: "nurse", gap: 2 }] },
        { workDate: "2026-07-02", missingRoles: [{ role: "nurse", gap: 1 }] },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.shortageCount, 3);
    assert.equal(rows[0]?.affectedDates.length, 2);
  });

  it("classifyCredentialRiskSeverity escalates blocked expiries", () => {
    assert.equal(classifyCredentialRiskSeverity(-1, true), "critical");
    assert.equal(classifyCredentialRiskSeverity(5, true), "high");
    assert.equal(classifyCredentialRiskSeverity(10, false), "medium");
  });

  it("forecastRecruitmentNeed recommends hires beyond late-stage pipeline", () => {
    const forecast = forecastRecruitmentNeed({
      roleRequirementsCount: 4,
      activePipelineCount: 6,
      lateStageCount: 1,
      staffingShortageTotal: 4,
    });
    assert.equal(forecast.recommendedHires, 3);
    assert.equal(forecast.pipelineCoveragePercent, 25);
  });

  it("forecastProcedureCapacity computes utilization", () => {
    const capacity = forecastProcedureCapacity({
      horizonDays: 14,
      scheduledProcedures: 10,
      fullyStaffedProcedures: 7,
      activeClinicalStaffCount: 20,
      avgTeamSizePerProcedure: 5,
    });
    assert.equal(capacity.understaffedProcedures, 3);
    assert.equal(capacity.capacityUtilizationPercent, 70);
    assert.equal(capacity.estimatedMaxProcedures, 7);
  });

  it("rankNextBestWorkforceActions prioritizes critical credential risk", () => {
    const actions = rankNextBestWorkforceActions({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      credentialRisks: [
        {
          staffMemberId: "m1",
          staffName: "Alex",
          itemType: "credential",
          displayName: "AHPRA",
          expiresAt: "2026-06-01",
          daysUntilExpiry: -30,
          blocksClinicalWork: true,
          severity: "critical",
        },
      ],
      staffingShortages: [],
      recruitmentForecast: forecastRecruitmentNeed({
        roleRequirementsCount: 0,
        activePipelineCount: 0,
        lateStageCount: 0,
        staffingShortageTotal: 0,
      }),
      procedureCapacity: forecastProcedureCapacity({
        horizonDays: 14,
        scheduledProcedures: 0,
        fullyStaffedProcedures: 0,
        activeClinicalStaffCount: 10,
        avgTeamSizePerProcedure: 5,
      }),
      weeklyWageExposureCents: 0,
      missingWageProfileCount: 0,
    });
    assert.equal(actions[0]?.id, "resolve-expired-credentials");
  });

  it("buildWorkforcePlanningSnapshot assembles next best actions", () => {
    const snapshot = buildWorkforcePlanningSnapshot({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-14",
      staffingShortages: [],
      credentialRisks: [],
      recruitmentForecast: forecastRecruitmentNeed({
        roleRequirementsCount: 2,
        activePipelineCount: 1,
        lateStageCount: 0,
        staffingShortageTotal: 0,
      }),
      procedureCapacity: forecastProcedureCapacity({
        horizonDays: 14,
        scheduledProcedures: 2,
        fullyStaffedProcedures: 2,
        activeClinicalStaffCount: 10,
        avgTeamSizePerProcedure: 5,
      }),
      weeklyWageExposureCents: 50_000,
      missingWageProfileCount: 0,
    });
    assert.ok(snapshot.nextBestActions.length >= 1);
    assert.equal(snapshot.horizonEnd, "2026-07-14");
  });
});