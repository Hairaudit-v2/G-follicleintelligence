import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clinicalStaffingDisplayStatusLabel,
  clinicalStaffingDisplayStatusTone,
  deriveClinicalStaffingDisplayStatus,
  toClinicalStaffingSummaryDto,
} from "@/src/lib/workforce-os/clinicalStaffingStatusDisplay";

test("deriveClinicalStaffingDisplayStatus maps engine output to UI states", () => {
  assert.equal(
    deriveClinicalStaffingDisplayStatus(
      { ready: true, missingRoles: [], blockedAssignments: [], warnings: [] },
      false
    ),
    "not_configured"
  );
  assert.equal(
    deriveClinicalStaffingDisplayStatus(
      { ready: true, missingRoles: [], blockedAssignments: [], warnings: [] },
      true
    ),
    "ready"
  );
  assert.equal(
    deriveClinicalStaffingDisplayStatus(
      {
        ready: false,
        missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
        blockedAssignments: [],
        warnings: [],
      },
      true
    ),
    "missing_roles"
  );
  assert.equal(
    deriveClinicalStaffingDisplayStatus(
      {
        ready: false,
        missingRoles: [],
        blockedAssignments: [{ staffId: "s1", role: "nurse", reason: "Blocked" }],
        warnings: [],
      },
      true
    ),
    "blocked"
  );
  assert.equal(
    deriveClinicalStaffingDisplayStatus(
      { ready: true, missingRoles: [], blockedAssignments: [], warnings: ["warn"] },
      true
    ),
    "warning"
  );
});

test("clinicalStaffingDisplayStatusLabel and tone are stable", () => {
  assert.equal(clinicalStaffingDisplayStatusLabel("ready"), "Staffing ready");
  assert.equal(clinicalStaffingDisplayStatusTone("blocked"), "danger");
  assert.equal(clinicalStaffingDisplayStatusTone("not_configured"), "neutral");
});

test("toClinicalStaffingSummaryDto preserves counts", () => {
  const dto = toClinicalStaffingSummaryDto(
    {
      ready: false,
      readinessScore: 72,
      requiredRoles: { nurse: 1 },
      assignedCounts: { nurse: 0 },
      missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
      blockedAssignments: [],
      warnings: [],
    },
    true
  );
  assert.equal(dto.displayStatus, "missing_roles");
  assert.equal(dto.readinessScore, 72);
  assert.equal(dto.missingRoles[0]?.role, "nurse");
});
