import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACADEMY_EVENTS,
  isEventTypeAllowedForModule,
} from "@/src/lib/analytics-os/analyticsEventTypes";
import { buildStaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import { rankAssignableStaffForRole } from "@/src/lib/workforce-os/workforceRosterCandidates";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";

const NOW = new Date("2026-06-22T12:00:00.000Z");

function readiness(): WorkforceReadinessScoreInput {
  return {
    is_active: true,
    staff_role: "technician",
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

test("ACADEMY_EVENTS includes procedure privilege lifecycle events", () => {
  assert.ok(ACADEMY_EVENTS.includes("procedure_privilege_granted"));
  assert.ok(ACADEMY_EVENTS.includes("procedure_privilege_suspended"));
  assert.ok(ACADEMY_EVENTS.includes("procedure_privilege_revoked"));
  assert.ok(ACADEMY_EVENTS.includes("procedure_privilege_expired"));
  assert.ok(ACADEMY_EVENTS.includes("privilege_requirement_missing"));
});

test("analytics validates academy privilege event types", () => {
  assert.ok(isEventTypeAllowedForModule("academy_os", "procedure_privilege_granted"));
  assert.ok(isEventTypeAllowedForModule("academy_os", "privilege_requirement_missing"));
});

test("rankAssignableStaffForRole surfaces missing privilege in blocked reasons", () => {
  const ranked = rankAssignableStaffForRole({
    tenantId: "00000000-0000-4000-8000-000000000001",
    clinicId: null,
    eventType: "surgery",
    assignedRole: "technician",
    startsAt: "2026-06-22T09:00:00.000Z",
    endsAt: "2026-06-22T17:00:00.000Z",
    existingAssignments: [],
    staffList: [
      {
        staffId: "staff-1",
        name: "Tech One",
        role: "technician",
        isActive: true,
        readinessInput: readiness(),
        privilegeEligibility: {
          eligible: false,
          status: "missing_privilege",
          matchedPrivilege: null,
          missingRequirements: [
            {
              requiredProcedureKey: "graft_sorting",
              minimumPrivilegeLevel: "assist",
              assignedRole: "technician",
            },
          ],
          warnings: [],
        },
      },
    ],
    availabilityByStaff: new Map(),
    conflictsByStaff: new Map(),
  });

  assert.equal(ranked[0]?.section, "blocked");
  assert.match(ranked[0]?.reasons.join(" ") ?? "", /Missing procedure privilege: graft_sorting/);
  assert.equal(ranked[0]?.procedurePrivilegeStatus, "missing_privilege");
});
