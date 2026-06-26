import assert from "node:assert/strict";
import { test } from "node:test";

import { enrichStaffDirectoryRows } from "@/src/lib/staff/staffDirectoryFilters";
import { buildStaffHrNotificationNoLinkSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import {
  buildWorkforceAttentionQueue,
  buildWorkforceCommandCentreMetrics,
  buildWorkforceIntelligencePanel,
  filterStaffByRoleSegment,
  formatReadinessScore,
  resolveStaffWorkforceIntelligence,
  staffMatchesRoleSegment,
} from "@/src/lib/staff/workforceCommandCentre";

function staff(p: Partial<FiStaffRow> & Pick<FiStaffRow, "id" | "full_name">): FiStaffRow {
  return {
    tenant_id: "t1",
    fi_user_id: null,
    staff_role: "consultant",
    position_type_id: null,
    email: null,
    mobile: null,
    default_timezone: null,
    working_hours: {},
    staff_metadata: {},
    is_active: true,
    calendar_color: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

test("staffMatchesRoleSegment maps clinical and management roles", () => {
  assert.equal(staffMatchesRoleSegment("surgeon", "clinical"), true);
  assert.equal(staffMatchesRoleSegment("reception", "clinical"), false);
  assert.equal(staffMatchesRoleSegment("admin", "management"), true);
  assert.equal(staffMatchesRoleSegment("nurse", "nurses"), true);
  assert.equal(staffMatchesRoleSegment("consultant", "surgeons"), false);
});

test("filterStaffByRoleSegment filters client-side", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({ id: "1", full_name: "A", staff_role: "surgeon" }),
      staff({ id: "2", full_name: "B", staff_role: "reception" }),
    ],
    {},
    {}
  );
  const surgeons = filterStaffByRoleSegment(rows, "surgeons");
  assert.equal(surgeons.length, 1);
  assert.equal(surgeons[0]?.full_name, "A");
});

test("buildWorkforceCommandCentreMetrics handles empty staff", () => {
  const metrics = buildWorkforceCommandCentreMetrics([], {});
  assert.deepEqual(metrics, {
    totalStaff: 0,
    activeStaff: 0,
    pendingOnboarding: 0,
    complianceIssues: 0,
    averageReadinessScore: null,
  });
});

test("buildWorkforceCommandCentreMetrics computes averages from server intelligence", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({ id: "1", full_name: "Ready", staff_role: "nurse" }),
      staff({ id: "2", full_name: "Warn", staff_role: "nurse", is_active: false }),
    ],
    {},
    {}
  );
  const metrics = buildWorkforceCommandCentreMetrics(rows, {
    "1": {
      readinessScore: 90,
      readinessBand: "fully_ready",
      readinessBandLabel: "Fully Ready",
      complianceStatus: "current",
      trainingRequiredCount: 0,
      trainingProgressLabel: "Complete",
      nextShiftLabel: null,
      surgeryReady: false,
    },
  });
  assert.equal(metrics.totalStaff, 2);
  assert.equal(metrics.activeStaff, 1);
  assert.equal(metrics.averageReadinessScore, 90);
});

test("resolveStaffWorkforceIntelligence falls back when server intel missing", () => {
  const rows = enrichStaffDirectoryRows([staff({ id: "1", full_name: "No HR" })], {}, {});
  const intel = resolveStaffWorkforceIntelligence(rows[0]!, undefined);
  assert.equal(intel.readinessScore, null);
  assert.equal(formatReadinessScore(intel.readinessScore), "—");
  assert.equal(intel.trainingProgressLabel, "—");
});

test("buildWorkforceAttentionQueue empty when all clear", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({
        id: "1",
        full_name: "Clear",
        staff_role: "consultant",
      }),
    ],
    {},
    {
      "1": {
        ...buildStaffHrNotificationNoLinkSummary(),
        hasHrLink: true,
        onboardingStatus: "complete",
        variant: "complete",
        badgeLabel: "Complete",
        shortLabel: "Complete",
      },
    }
  );
  const queue = buildWorkforceAttentionQueue(rows, {
    "1": {
      readinessScore: 92,
      readinessBand: "fully_ready",
      readinessBandLabel: "Fully Ready",
      complianceStatus: "current",
      trainingRequiredCount: 0,
      trainingProgressLabel: "Complete",
      nextShiftLabel: null,
      surgeryReady: false,
    },
  });
  assert.equal(queue.length, 0);
});

test("buildWorkforceIntelligencePanel recommends onboarding when pending", () => {
  const rows = enrichStaffDirectoryRows(
    [staff({ id: "1", full_name: "New", staff_role: "needs_review" })],
    {},
    {}
  );
  const metrics = buildWorkforceCommandCentreMetrics(rows, {});
  const panel = buildWorkforceIntelligencePanel(rows, {}, metrics);
  assert.match(panel.nextAction, /onboarding/i);
});

test("buildWorkforceAttentionQueue includes inactive staff", () => {
  const rows = enrichStaffDirectoryRows(
    [staff({ id: "1", full_name: "Away", is_active: false })],
    {},
    {}
  );
  const queue = buildWorkforceAttentionQueue(rows, {});
  assert.equal(queue.length, 1);
  assert.ok(queue[0]?.reasons.includes("inactive"));
});
