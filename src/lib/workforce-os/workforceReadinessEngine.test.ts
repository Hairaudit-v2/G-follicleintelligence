import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveStaffReadinessState } from "@/src/lib/hr/hrStaffReadinessDashboard";
import {
  buildStaffHrNotificationNoLinkSummary,
  buildStaffHrNotificationSummary,
  STAFF_HR_SYNC_STALE_DAYS,
} from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import { canStaffBeAssignedClinically } from "@/src/lib/workforce-os/workforceReadinessClinicalEligibility";
import {
  clampWorkforceReadinessScore,
  resolveWorkforceReadinessBand,
  WORKFORCE_CLINICAL_ASSIGNMENT_MIN_SCORE,
} from "@/src/lib/workforce-os/workforceReadinessBands";
import {
  calculateWorkforceReadinessScore,
  WORKFORCE_READINESS_FACTOR_WEIGHTS,
  WORKFORCE_READINESS_RAW_MAX,
  type WorkforceReadinessScoreInput,
} from "@/src/lib/workforce-os/workforceReadinessEngine";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function workingHours(): Record<string, unknown> {
  return { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } };
}

function freshHr(overrides: Record<string, unknown> = {}) {
  return buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      source_url: "https://hr.example/s/1",
      metadata: {
        onboarding_status: "complete",
        training_required_count: 0,
        required_documents_missing_count: 0,
        certificates_outstanding_count: 0,
        last_synced_at: NOW.toISOString(),
        competency_source: "iiohr_hr",
        sync_status: "active",
        ...overrides,
      },
    },
    NOW
  );
}

function identityRows(overrides: {
  hr?: boolean;
  academy?: boolean;
  nexus?: boolean;
  hrMeta?: Record<string, unknown>;
  academyMeta?: Record<string, unknown>;
} = {}) {
  const rows = [];
  if (overrides.hr !== false) {
    rows.push({
      source_system: "iiohr_hr",
      source_staff_id: "hr-1",
      metadata: {
        last_synced_at: NOW.toISOString(),
        sync_status: "active",
        training_source: "iiohr_hr",
        certification_source: "iiohr_hr",
        competency_source: "iiohr_hr",
        ...overrides.hrMeta,
      },
    });
  }
  if (overrides.academy) {
    rows.push({
      source_system: "iiohr_academy",
      source_staff_id: "academy-1",
      metadata: {
        last_synced_at: NOW.toISOString(),
        sync_status: "active",
        training_source: "iiohr_academy",
        ...overrides.academyMeta,
      },
    });
  }
  if (overrides.nexus) {
    rows.push({
      source_system: "iiohr_nexus",
      source_staff_id: "nexus-1",
      metadata: {
        last_synced_at: NOW.toISOString(),
        sync_status: "active",
        global_professional_id: "gp-1",
      },
    });
  }
  return rows;
}

function perfectInput(overrides: Partial<WorkforceReadinessScoreInput> = {}): WorkforceReadinessScoreInput {
  return {
    is_active: true,
    staff_role: "consultant",
    working_hours: workingHours(),
    hr: freshHr(),
    identityRows: identityRows({ academy: true }),
    compliance: buildStaffComplianceSummaryFromSourceRows([], { now: NOW }),
    now: NOW,
    ...overrides,
  };
}

test("perfect staff scores 100 with all factors at max", () => {
  const result = calculateWorkforceReadinessScore(perfectInput());
  assert.equal(result.score, 100);
  assert.equal(result.band, "elite_ready");
  assert.equal(result.blocking_issues.length, 0);
  assert.equal(result.factors.length, 9);
  const totalMax = result.factors.reduce((s, f) => s + f.maxScore, 0);
  assert.equal(totalMax, WORKFORCE_READINESS_RAW_MAX);
});

test("band classification covers full score range", () => {
  assert.equal(resolveWorkforceReadinessBand(100).id, "elite_ready");
  assert.equal(resolveWorkforceReadinessBand(95).id, "elite_ready");
  assert.equal(resolveWorkforceReadinessBand(94).id, "fully_ready");
  assert.equal(resolveWorkforceReadinessBand(85).id, "fully_ready");
  assert.equal(resolveWorkforceReadinessBand(84).id, "operational_warning");
  assert.equal(resolveWorkforceReadinessBand(70).id, "operational_warning");
  assert.equal(resolveWorkforceReadinessBand(69).id, "restricted_assignment");
  assert.equal(resolveWorkforceReadinessBand(50).id, "restricted_assignment");
  assert.equal(resolveWorkforceReadinessBand(49).id, "not_eligible");
  assert.equal(resolveWorkforceReadinessBand(0).id, "not_eligible");
});

test("clampWorkforceReadinessScore bounds 0–100", () => {
  assert.equal(clampWorkforceReadinessScore(-5), 0);
  assert.equal(clampWorkforceReadinessScore(150), 100);
  assert.equal(clampWorkforceReadinessScore(82.6), 83);
});

test("missing HR link blocks and reduces score", () => {
  const result = calculateWorkforceReadinessScore(
    perfectInput({
      hr: buildStaffHrNotificationNoLinkSummary(),
      identityRows: [],
    })
  );
  assert.ok(result.blocking_issues.includes("no_hr_identity"));
  assert.ok(result.score < 70);
  assert.ok(result.band === "not_eligible" || result.band === "restricted_assignment");
});

test("no Academy link reduces academy sync factor but does not block", () => {
  const withAcademy = calculateWorkforceReadinessScore(perfectInput());
  const withoutAcademy = calculateWorkforceReadinessScore(
    perfectInput({ identityRows: identityRows({ academy: false }) })
  );
  assert.equal(withAcademy.score, 100);
  assert.ok(withoutAcademy.score < withAcademy.score);
  assert.equal(withoutAcademy.blocking_issues.length, 0);
});

test("training incomplete blocks assignment", () => {
  const result = calculateWorkforceReadinessScore(
    perfectInput({
      hr: freshHr({ training_required_count: 2 }),
    })
  );
  assert.ok(result.blocking_issues.includes("training_incomplete"));
  assert.ok(result.score < 100);
});

test("certification expired blocks", () => {
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr_hr",
        metadata: {
          compliance: [
            {
              id: "cert-basic",
              label: "Clinical Certificate",
              completed_at: "2024-01-01T00:00:00.000Z",
              expires_at: "2025-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ],
    { now: NOW }
  );
  const result = calculateWorkforceReadinessScore(perfectInput({ compliance }));
  assert.ok(result.blocking_issues.includes("certification_expired"));
  assert.ok(result.blocking_issues.includes("critical_compliance_expired"));
});

test("mandatory SOP missing blocks", () => {
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr_hr",
        metadata: {
          compliance: [{ id: "sop-1", label: "SOP Infection Control", status: "missing" }],
        },
      },
    ],
    { now: NOW }
  );
  const result = calculateWorkforceReadinessScore(perfectInput({ compliance }));
  assert.ok(result.blocking_issues.includes("mandatory_sop_incomplete"));
});

test("working hours missing reduces score and emits warning", () => {
  const result = calculateWorkforceReadinessScore(
    perfectInput({ working_hours: {} })
  );
  assert.ok(result.warnings.includes("working_hours_incomplete"));
  const hoursFactor = result.factors.find((f) => f.key === "working_hours");
  assert.equal(hoursFactor?.score, 0);
  assert.equal(hoursFactor?.maxScore, WORKFORCE_READINESS_FACTOR_WEIGHTS.working_hours);
});

test("stale HR sync reduces score and emits warning", () => {
  const staleDate = new Date(NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000);
  const result = calculateWorkforceReadinessScore(
    perfectInput({
      hr: freshHr({ last_synced_at: staleDate.toISOString() }),
      identityRows: identityRows({
        academy: true,
        hrMeta: { last_synced_at: staleDate.toISOString() },
      }),
    })
  );
  assert.ok(result.warnings.includes("hr_sync_stale"));
  assert.ok(result.factors.find((f) => f.key === "hr_sync")!.score < WORKFORCE_READINESS_FACTOR_WEIGHTS.hr_sync);
});

test("academy sync stale emits warning", () => {
  const staleDate = new Date(NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000);
  const result = calculateWorkforceReadinessScore(
    perfectInput({
      identityRows: identityRows({
        academy: true,
        academyMeta: { last_synced_at: staleDate.toISOString() },
      }),
    })
  );
  assert.ok(result.warnings.includes("academy_sync_stale"));
});

test("sync revoked is a hard block", () => {
  const result = calculateWorkforceReadinessScore(
    perfectInput({
      identityRows: identityRows({
        academy: true,
        hrMeta: { sync_status: "revoked" },
      }),
    })
  );
  assert.ok(result.blocking_issues.includes("sync_revoked"));
});

test("SOP expiring soon emits warning without blocking", () => {
  const expiresSoon = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr_hr",
        metadata: {
          compliance: [
            {
              id: "sop-1",
              label: "SOP Hand Hygiene",
              completed_at: "2026-01-01T00:00:00.000Z",
              expires_at: expiresSoon,
            },
          ],
        },
      },
    ],
    { now: NOW }
  );
  const result = calculateWorkforceReadinessScore(perfectInput({ compliance }));
  assert.ok(result.warnings.includes("sop_expiring_soon"));
  assert.equal(result.blocking_issues.includes("mandatory_sop_incomplete"), false);
});

test("canStaffBeAssignedClinically allows fully ready staff", () => {
  const eligibility = canStaffBeAssignedClinically(perfectInput());
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.score, 100);
  assert.equal(eligibility.warnings.length, 0);
});

test("canStaffBeAssignedClinically rejects score below 70", () => {
  const eligibility = canStaffBeAssignedClinically(
    perfectInput({
      is_active: false,
      hr: buildStaffHrNotificationNoLinkSummary(),
      identityRows: [],
    })
  );
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.score < WORKFORCE_CLINICAL_ASSIGNMENT_MIN_SCORE);
});

test("canStaffBeAssignedClinically rejects blocking issues even with high score", () => {
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr_hr",
        metadata: {
          compliance: [{ id: "sop-1", label: "SOP Safety", status: "missing" }],
        },
      },
    ],
    { now: NOW }
  );
  const eligibility = canStaffBeAssignedClinically(perfectInput({ compliance }));
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.blocking_issues.includes("mandatory_sop_incomplete"));
});

test("backward compatibility: legacy deriveStaffReadinessState unchanged for ready staff", () => {
  const hr = freshHr();
  const legacy = deriveStaffReadinessState({
    is_active: true,
    staff_role: "consultant",
    working_hours: workingHours(),
    hr,
  });
  assert.equal(legacy, "ready");

  const v2 = calculateWorkforceReadinessScore(perfectInput());
  assert.equal(v2.score, 100);
  assert.equal(v2.blocking_issues.length, 0);
});

test("backward compatibility: legacy states still derive independently", () => {
  const hr = freshHr({ training_required_count: 3 });
  const legacy = deriveStaffReadinessState({
    is_active: true,
    staff_role: "consultant",
    working_hours: workingHours(),
    hr,
  });
  assert.equal(legacy, "needs_training");

  const v2 = calculateWorkforceReadinessScore(perfectInput({ hr }));
  assert.ok(v2.blocking_issues.includes("training_incomplete"));
  assert.ok(v2.score < 100);
});

test("inactive staff blocks clinically and scores zero availability", () => {
  const result = calculateWorkforceReadinessScore(perfectInput({ is_active: false }));
  assert.ok(result.blocking_issues.includes("inactive"));
  assert.equal(result.factors.find((f) => f.key === "availability")?.score, 0);

  const eligibility = canStaffBeAssignedClinically(perfectInput({ is_active: false }));
  assert.equal(eligibility.eligible, false);
});

test("factor weights raw max is 105 (normalized to 0–100 headline score)", () => {
  assert.equal(WORKFORCE_READINESS_RAW_MAX, 105);
});
