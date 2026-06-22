import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_PROCEDURE_PRIVILEGE_REQUIREMENTS } from "@/src/lib/academy-os/procedurePrivilegeRequirementDefaults";
import { buildStaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import { canStaffBeAssignedToProcedure } from "@/src/lib/workforce-os/workforceProcedureClinicalEligibility";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";

const NOW = new Date("2026-06-22T12:00:00.000Z");

function perfectReadiness(): WorkforceReadinessScoreInput {
  return {
    is_active: true,
    staff_role: "surgeon",
    working_hours: { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } },
    hr: buildStaffHrNotificationSummary(
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
        },
      },
      NOW
    ),
    identityRows: [
      {
        source_system: "iiohr_hr",
        source_staff_id: "hr-1",
        metadata: {
          last_synced_at: NOW.toISOString(),
          sync_status: "active",
          training_source: "iiohr_hr",
          certification_source: "iiohr_hr",
          competency_source: "iiohr_hr",
        },
      },
      {
        source_system: "iiohr_academy",
        source_staff_id: "academy-1",
        metadata: {
          last_synced_at: NOW.toISOString(),
          sync_status: "active",
          training_source: "iiohr_academy",
        },
      },
    ],
    compliance: buildStaffComplianceSummaryFromSourceRows([], { now: NOW }),
    now: NOW,
  };
}

test("default procedure privilege requirement templates are unique per event/role/procedure", () => {
  const keys = DEFAULT_PROCEDURE_PRIVILEGE_REQUIREMENTS.map(
    (row) => `${row.event_type}::${row.assigned_role}::${row.required_procedure_key}`
  );
  assert.equal(keys.length, new Set(keys).size);
});

test("canStaffBeAssignedToProcedure blocks missing privilege when requirements configured", () => {
  const result = canStaffBeAssignedToProcedure({
    readinessInput: perfectReadiness(),
    privilegeEligibility: {
      eligible: false,
      status: "missing_privilege",
      matchedPrivilege: null,
      missingRequirements: [
        {
          requiredProcedureKey: "fue_extraction",
          minimumPrivilegeLevel: "perform_independent",
          assignedRole: "surgeon",
        },
      ],
      warnings: [],
    },
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason ?? "", /Missing procedure privilege: fue_extraction/);
});

test("canStaffBeAssignedToProcedure does not block when no requirements configured", () => {
  const result = canStaffBeAssignedToProcedure({
    readinessInput: perfectReadiness(),
    privilegeEligibility: {
      eligible: true,
      status: "eligible",
      matchedPrivilege: null,
      missingRequirements: [],
      warnings: ["no_privilege_requirement_configured"],
    },
  });

  assert.equal(result.eligible, true);
  assert.ok(result.procedurePrivilegeWarnings.includes("no_privilege_requirement_configured"));
});

test("canStaffBeAssignedToProcedure preserves readiness blockers", () => {
  const result = canStaffBeAssignedToProcedure({
    readinessInput: { ...perfectReadiness(), is_active: false },
    privilegeEligibility: {
      eligible: true,
      status: "eligible",
      matchedPrivilege: null,
      missingRequirements: [],
      warnings: [],
    },
  });

  assert.equal(result.eligible, false);
});
