import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProcedureStaffingRecommendation,
  computeOptimizerScore,
  enrichCandidateWithCost,
  selectRecommendedTeamForRole,
  summarizeProcedureStaffingOptimizer,
} from "@/src/lib/workforce/procedureStaffingOptimizerCore";
import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";

function candidate(
  partial: Partial<RosterAssignableCandidate> & Pick<RosterAssignableCandidate, "staffId" | "name">
): RosterAssignableCandidate {
  return {
    role: "nurse",
    readinessScore: 80,
    readinessBand: "green",
    eligible: true,
    reasons: [],
    warnings: [],
    conflicts: [],
    rankScore: 80,
    section: "eligible",
    procedurePrivilegeStatus: null,
    procedurePrivilegeEligible: true,
    privilegeWarnings: [],
    ...partial,
  };
}

describe("procedureStaffingOptimizerCore", () => {
  it("computeOptimizerScore penalizes blocked and high-cost candidates", () => {
    const low = computeOptimizerScore({ rankScore: 90, section: "eligible", grossCostCents: 20_000 });
    const high = computeOptimizerScore({ rankScore: 90, section: "eligible", grossCostCents: 120_000 });
    const blocked = computeOptimizerScore({ rankScore: 90, section: "blocked", grossCostCents: 0 });
    assert.ok(low > high);
    assert.ok(low > blocked);
  });

  it("selectRecommendedTeamForRole excludes auto-blocked staff", () => {
    const pool = [
      enrichCandidateWithCost({
        candidate: candidate({ staffId: "a", name: "A", section: "eligible", rankScore: 90 }),
        assignedRole: "nurse",
        wage: { rateType: "hourly", baseRateCents: 5000, awardLoadings: [] },
        minutesWorked: 480,
      }),
      enrichCandidateWithCost({
        candidate: candidate({
          staffId: "b",
          name: "B",
          section: "blocked",
          eligible: false,
          rankScore: 95,
        }),
        assignedRole: "nurse",
        wage: { rateType: "hourly", baseRateCents: 4000, awardLoadings: [] },
        minutesWorked: 480,
      }),
    ];
    const { selected, blocked } = selectRecommendedTeamForRole(pool, 1);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.staffId, "a");
    assert.equal(blocked.length, 1);
  });

  it("buildProcedureStaffingRecommendation marks incomplete when roles missing", () => {
    const rec = buildProcedureStaffingRecommendation({
      surgeryId: "sx1",
      procedureLabel: "FUE",
      scheduledDate: "2026-07-01",
      startsAt: "2026-07-01T08:00:00.000Z",
      endsAt: "2026-07-01T16:00:00.000Z",
      clinicId: null,
      eventType: "surgery",
      requiredRoles: { surgeon: 1, nurse: 2 },
      minutesWorked: 480,
      existingAssignmentsByRole: {},
      roleCandidates: {
        surgeon: [
          enrichCandidateWithCost({
            candidate: candidate({ staffId: "s1", name: "Surgeon", rankScore: 88 }),
            assignedRole: "surgeon",
            wage: { rateType: "daily", baseRateCents: 200_000, awardLoadings: [] },
            minutesWorked: 480,
          }),
        ],
        nurse: [],
      },
    });
    assert.equal(rec.staffingComplete, false);
    assert.equal(rec.recommendedTeam.length, 1);
    assert.equal(rec.missingRoles.length, 1);
    assert.equal(rec.missingRoles[0]?.role, "nurse");
  });

  it("summarizeProcedureStaffingOptimizer aggregates totals", () => {
    const summary = summarizeProcedureStaffingOptimizer({
      workDate: "2026-07-01",
      recommendations: [
        {
          surgeryId: "a",
          procedureLabel: "A",
          scheduledDate: "2026-07-01",
          startsAt: "",
          endsAt: "",
          clinicId: null,
          eventType: "surgery",
          requiredRoles: { surgeon: 1 },
          recommendedTeam: [],
          blockedStaff: [{ staffId: "x", name: "X" } as never],
          alternateCandidates: [],
          missingRoles: [],
          totalTeamCostCents: 50_000,
          staffingComplete: true,
          minutesWorked: 480,
        },
      ],
    });
    assert.equal(summary.procedureCount, 1);
    assert.equal(summary.completeCount, 1);
    assert.equal(summary.blockedStaffCount, 1);
    assert.equal(summary.totalRecommendedCostCents, 50_000);
  });
});