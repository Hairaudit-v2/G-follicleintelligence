import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterAssignableCandidate } from "@/src/lib/workforce-os/workforceRosterCandidates";
import type {
  ProcedureStaffingOptimizerSnapshot,
  ProcedureStaffingRecommendation,
} from "@/src/lib/workforce/procedureStaffingOptimizerCore";
import {
  buildClinicalCapacityIntel,
  buildProcedureStaffingQualityIntel,
  buildSurgicalWorkforceRecommendations,
  buildTomorrowSurgeryReadinessIntel,
  clampSurgicalScore,
  composeSurgicalWorkforceIntelligence,
  detectSurgicalStaffingRisks,
  readinessToStatus,
} from "@/src/lib/workforce/surgicalWorkforceIntelligenceCore";
import type { SurgicalWorkforceIntelligenceInput } from "@/src/lib/workforce/surgicalWorkforceIntelligenceCore";
import { buildWorkforcePlanningSnapshot } from "@/src/lib/workforce/workforcePlanningEngineCore";

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

function recommendation(
  partial: Partial<ProcedureStaffingRecommendation> &
    Pick<ProcedureStaffingRecommendation, "surgeryId" | "scheduledDate">
): ProcedureStaffingRecommendation {
  return {
    procedureLabel: "FUE",
    startsAt: `${partial.scheduledDate}T08:00:00.000Z`,
    endsAt: `${partial.scheduledDate}T16:00:00.000Z`,
    clinicId: null,
    eventType: "surgery",
    requiredRoles: { surgeon: 1, nurse: 1, technician: 1 },
    recommendedTeam: [],
    blockedStaff: [],
    alternateCandidates: [],
    missingRoles: [],
    totalTeamCostCents: 0,
    staffingComplete: true,
    minutesWorked: 480,
    ...partial,
  };
}

function snapshot(
  workDate: string,
  recommendations: ProcedureStaffingRecommendation[]
): ProcedureStaffingOptimizerSnapshot {
  return {
    workDate,
    procedureCount: recommendations.length,
    completeCount: recommendations.filter((r) => r.staffingComplete).length,
    blockedStaffCount: recommendations.reduce((sum, r) => sum + r.blockedStaff.length, 0),
    totalRecommendedCostCents: 0,
    recommendations,
  };
}

const baseInput: SurgicalWorkforceIntelligenceInput = {
  tenantId: "tenant-1",
  tomorrowDate: "2026-07-02",
  tomorrowOptimizer: null,
  weekOptimizers: [],
  planning: null,
  activeClinicalStaffCount: 12,
};

describe("surgicalWorkforceIntelligenceCore", () => {
  it("clampSurgicalScore clamps and handles invalid values", () => {
    assert.equal(clampSurgicalScore(130), 100);
    assert.equal(clampSurgicalScore(-10), 0);
    assert.equal(clampSurgicalScore(Number.NaN), 0);
    assert.equal(readinessToStatus(95), "optimal");
    assert.equal(readinessToStatus(75), "watch");
    assert.equal(readinessToStatus(40), "risk");
  });

  it("buildTomorrowSurgeryReadinessIntel returns empty state when no surgeries tomorrow", () => {
    const intel = buildTomorrowSurgeryReadinessIntel(snapshot("2026-07-02", []));
    assert.equal(intel.summary, "No surgeries scheduled tomorrow.");
    assert.equal(intel.surgeriesScheduled, 0);
    assert.equal(intel.readinessScore, 100);
    assert.equal(intel.status, "optimal");
  });

  it("buildTomorrowSurgeryReadinessIntel reports fully staffed procedures", () => {
    const intel = buildTomorrowSurgeryReadinessIntel(
      snapshot("2026-07-02", [
        recommendation({ surgeryId: "s1", scheduledDate: "2026-07-02", staffingComplete: true }),
        recommendation({ surgeryId: "s2", scheduledDate: "2026-07-02", staffingComplete: true }),
      ])
    );
    assert.equal(intel.surgeriesScheduled, 2);
    assert.equal(intel.fullyStaffed, 2);
    assert.equal(intel.atRisk, 0);
    assert.ok(intel.readinessScore >= 90);
    assert.ok(intel.summary.includes("fully staffed"));
  });

  it("buildTomorrowSurgeryReadinessIntel detects missing RN assignment", () => {
    const intel = buildTomorrowSurgeryReadinessIntel(
      snapshot("2026-07-02", [
        recommendation({
          surgeryId: "s1",
          scheduledDate: "2026-07-02",
          staffingComplete: false,
          missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
        }),
      ])
    );
    assert.equal(intel.missingRnAssignments, 1);
    assert.equal(intel.atRisk, 1);
    assert.ok(intel.summary.includes("understaffed"));
    assert.ok(intel.readinessScore < 90);
  });

  it("buildTomorrowSurgeryReadinessIntel detects missing surgeon assignment", () => {
    const intel = buildTomorrowSurgeryReadinessIntel(
      snapshot("2026-07-02", [
        recommendation({
          surgeryId: "s1",
          scheduledDate: "2026-07-02",
          staffingComplete: false,
          missingRoles: [{ role: "surgeon", required: 1, assigned: 0 }],
        }),
      ])
    );
    assert.equal(intel.missingSurgeonAssignments, 1);
    assert.equal(intel.status, "risk");
  });

  it("buildProcedureStaffingQualityIntel flags unsafe staffing assignments", () => {
    const quality = buildProcedureStaffingQualityIntel([
      snapshot("2026-07-02", [
        recommendation({
          surgeryId: "s1",
          scheduledDate: "2026-07-02",
          staffingComplete: false,
          missingRoles: [{ role: "technician", required: 1, assigned: 0 }],
          recommendedTeam: [
            {
              ...candidate({ staffId: "n1", name: "Nurse", section: "warning", warnings: ["Low readiness"] }),
              assignedRole: "nurse",
              grossCostCents: 0,
              optimizerScore: 50,
              autoBlocked: false,
            },
          ],
        }),
      ]),
    ]);
    assert.equal(quality.unsafeAssignments, 1);
    assert.equal(quality.incompleteAssignments, 1);
    assert.ok(quality.staffingQualityScore < 100);
    assert.ok(quality.summary.includes("%"));
  });

  it("detectSurgicalStaffingRisks detects double booking and credential expiry conflict", () => {
    const planning = buildWorkforcePlanningSnapshot({
      tenantId: "tenant-1",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-14",
      staffingShortages: [],
      credentialRisks: [
        {
          staffMemberId: "tech-1",
          staffName: "Tech One",
          itemType: "credential",
          displayName: "Sterile field",
          expiresAt: "2026-07-12",
          daysUntilExpiry: 0,
          blocksClinicalWork: true,
          severity: "critical",
        },
      ],
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
        scheduledProcedures: 2,
        fullyStaffedProcedures: 1,
        understaffedProcedures: 1,
        capacityUtilizationPercent: 50,
        estimatedMaxProcedures: 4,
      },
      weeklyWageExposureCents: 0,
      missingWageProfileCount: 0,
    });

    const weekOptimizers = [
      snapshot("2026-07-12", [
        recommendation({
          surgeryId: "s1",
          scheduledDate: "2026-07-12",
          staffingComplete: true,
          recommendedTeam: [
            {
              ...candidate({
                staffId: "tech-1",
                name: "Tech One",
                conflicts: [{ kind: "assignment_overlap", message: "Already assigned" }],
              }),
              assignedRole: "technician",
              grossCostCents: 0,
              optimizerScore: 80,
              autoBlocked: false,
            },
          ],
        }),
      ]),
      snapshot("2026-07-14", [
        recommendation({
          surgeryId: "s2",
          scheduledDate: "2026-07-14",
          staffingComplete: false,
          missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
        }),
      ]),
    ];

    const risks = detectSurgicalStaffingRisks({
      ...baseInput,
      planning,
      weekOptimizers,
    });

    assert.ok(risks.totalRisks >= 2);
    assert.ok(risks.detectedRisks.some((r) => r.title.includes("double booked")));
    assert.ok(risks.detectedRisks.some((r) => r.title.includes("RN missing")));
    assert.ok(risks.detectedRisks.some((r) => r.title.includes("Credential expires")));
  });

  it("buildClinicalCapacityIntel reports unused surgery hours", () => {
    const capacity = buildClinicalCapacityIntel({
      ...baseInput,
      activeClinicalStaffCount: 10,
      planning: buildWorkforcePlanningSnapshot({
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
          scheduledProcedures: 1,
          fullyStaffedProcedures: 1,
          understaffedProcedures: 0,
          capacityUtilizationPercent: 25,
          estimatedMaxProcedures: 5,
        },
        weeklyWageExposureCents: 0,
        missingWageProfileCount: 0,
      }),
      weekOptimizers: [
        snapshot("2026-07-01", [
          recommendation({ surgeryId: "s1", scheduledDate: "2026-07-01", minutesWorked: 480 }),
        ]),
      ],
    });

    assert.ok(capacity.unusedHours > 0);
    assert.ok(capacity.summary.includes("available surgery hours"));
    assert.ok(capacity.weeklyCapacityPercent >= 0 && capacity.weeklyCapacityPercent <= 100);
  });

  it("buildSurgicalWorkforceRecommendations ranks higher severity first", () => {
    const risks = detectSurgicalStaffingRisks({
      ...baseInput,
      weekOptimizers: [
        snapshot("2026-07-12", [
          recommendation({
            surgeryId: "s1",
            scheduledDate: "2026-07-12",
            staffingComplete: false,
            missingRoles: [{ role: "surgeon", required: 1, assigned: 0 }],
          }),
        ]),
      ],
    });
    const recs = buildSurgicalWorkforceRecommendations(
      {
        ...baseInput,
        tomorrowOptimizer: snapshot("2026-07-02", [
          recommendation({
            surgeryId: "s2",
            scheduledDate: "2026-07-02",
            staffingComplete: false,
            missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
          }),
        ]),
      },
      risks
    );
    assert.ok(recs.length >= 2);
    assert.ok(recs[0]!.score >= recs[1]!.score);
    assert.ok(recs.every((r) => r.route.includes("/workforce-os/")));
  });

  it("composeSurgicalWorkforceIntelligence produces finite scores without NaN", () => {
    const panel = composeSurgicalWorkforceIntelligence({
      ...baseInput,
      tomorrowOptimizer: snapshot("2026-07-02", [
        recommendation({ surgeryId: "s1", scheduledDate: "2026-07-02" }),
      ]),
      weekOptimizers: [snapshot("2026-07-02", [recommendation({ surgeryId: "s1", scheduledDate: "2026-07-02" })])],
    });

    assert.ok(Number.isFinite(panel.tomorrowReadiness.readinessScore));
    assert.ok(Number.isFinite(panel.staffingQuality.staffingQualityScore));
    assert.ok(Number.isFinite(panel.clinicalCapacity.weeklyCapacityPercent));
    assert.ok(panel.tomorrowReadiness.readinessScore >= 0 && panel.tomorrowReadiness.readinessScore <= 100);
    assert.ok(panel.recommendations.length <= 6);
  });
});