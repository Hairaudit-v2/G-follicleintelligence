import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStaffHrNotificationSummary,
} from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import {
  isDuplicateRosterAssignment,
  rankAssignableStaffForRole,
} from "@/src/lib/workforce-os/workforceRosterCandidates";
import type { StaffAvailabilityRangeInput } from "@/src/lib/workforce-os/workforceRosteringEngine";

const NOW = new Date("2026-06-08T04:00:00.000Z");
const RANGE_START = "2026-06-08T01:00:00.000Z";
const RANGE_END = "2026-06-08T09:00:00.000Z";

function workingHours(): Record<string, unknown> {
  return { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } };
}

function freshReadinessInput(
  overrides: Partial<import("@/src/lib/workforce-os/workforceReadinessEngine").WorkforceReadinessScoreInput> = {}
) {
  const hr = buildStaffHrNotificationSummary(
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
  );
  const identityRows = [
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
  ];
  const compliance = buildStaffComplianceSummaryFromSourceRows(
    identityRows.map((row) => ({ source_system: row.source_system, metadata: row.metadata })),
    { now: NOW }
  );
  return {
    is_active: true,
    staff_role: "nurse",
    working_hours: workingHours(),
    hr,
    identityRows,
    compliance,
    now: NOW,
    ...overrides,
  };
}

function availabilityInput(staffId: string): StaffAvailabilityRangeInput {
  return {
    staffId,
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    availabilityBlocks: [],
    shifts: [],
  };
}

test("rankAssignableStaffForRole orders eligible staff before blocked staff", () => {
  const ranked = rankAssignableStaffForRole({
    tenantId: "tenant",
    clinicId: "clinic-a",
    eventType: "surgery",
    assignedRole: "nurse",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    existingAssignments: [],
    staffList: [
      {
        staffId: "eligible-1",
        name: "Eligible Nurse",
        role: "nurse",
        isActive: true,
        clinicId: "clinic-a",
        readinessInput: freshReadinessInput({ staff_role: "nurse" }),
      },
      {
        staffId: "blocked-1",
        name: "Inactive Nurse",
        role: "nurse",
        isActive: false,
        clinicId: "clinic-a",
        readinessInput: freshReadinessInput({ is_active: false, staff_role: "nurse" }),
      },
    ],
    availabilityByStaff: new Map([
      ["eligible-1", availabilityInput("eligible-1")],
      ["blocked-1", availabilityInput("blocked-1")],
    ]),
    conflictsByStaff: new Map(),
  });

  assert.equal(ranked[0]?.section, "eligible");
  assert.equal(ranked.at(-1)?.section, "blocked");
});

test("rankAssignableStaffForRole prefers matching role and higher readiness", () => {
  const ranked = rankAssignableStaffForRole({
    tenantId: "tenant",
    eventType: "surgery",
    assignedRole: "nurse",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    existingAssignments: [],
    staffList: [
      {
        staffId: "tech-1",
        name: "Technician",
        role: "technician",
        isActive: true,
        readinessInput: freshReadinessInput({ staff_role: "technician" }),
      },
      {
        staffId: "nurse-1",
        name: "Nurse",
        role: "nurse",
        isActive: true,
        readinessInput: freshReadinessInput({ staff_role: "nurse" }),
      },
    ],
    availabilityByStaff: new Map([
      ["tech-1", availabilityInput("tech-1")],
      ["nurse-1", availabilityInput("nurse-1")],
    ]),
    conflictsByStaff: new Map(),
  });

  assert.equal(ranked[0]?.staffId, "nurse-1");
  assert.equal(ranked[0]?.section, "eligible");
});

test("rankAssignableStaffForRole excludes staff already assigned to event", () => {
  const ranked = rankAssignableStaffForRole({
    tenantId: "tenant",
    eventType: "surgery",
    assignedRole: "nurse",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    existingAssignments: [{ staffId: "nurse-1", assignedRole: "surgeon" }],
    staffList: [
      {
        staffId: "nurse-1",
        name: "Already assigned",
        role: "nurse",
        isActive: true,
        readinessInput: freshReadinessInput({ staff_role: "nurse" }),
      },
    ],
    availabilityByStaff: new Map([["nurse-1", availabilityInput("nurse-1")]]),
    conflictsByStaff: new Map(),
  });

  assert.equal(ranked.length, 0);
});

test("isDuplicateRosterAssignment detects active duplicate rows", () => {
  assert.equal(
    isDuplicateRosterAssignment({
      staffId: "staff-1",
      assignedRole: "Nurse",
      existingAssignments: [{ staffId: "staff-1", assignedRole: "nurse", assignmentStatus: "scheduled" }],
    }),
    true
  );
  assert.equal(
    isDuplicateRosterAssignment({
      staffId: "staff-1",
      assignedRole: "nurse",
      existingAssignments: [{ staffId: "staff-1", assignedRole: "nurse", assignmentStatus: "cancelled" }],
    }),
    false
  );
});
