import assert from "node:assert/strict";
import { test } from "node:test";

import { buildStaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import { normalizeRequiredRoles } from "@/src/lib/workforce-os/workforceClinicalStaffingTemplateDefaults";
import {
  assignStaffToClinicalEvent,
  countAssignedRoles,
  detectMissingRoles,
  detectStaffSchedulingConflicts,
  getStaffAvailabilityForRange,
  resolveClinicalStaffingTemplate,
  validateClinicalEventStaffing,
  type ClinicalStaffingTemplateRecord,
  type StaffAvailabilityBlockRecord,
  type StaffEventAssignmentRecord,
  type StaffShiftRecord,
} from "@/src/lib/workforce-os/workforceRosteringEngine";

const NOW = new Date("2026-06-08T04:00:00.000Z");
/** Monday 09:00–17:00 in Australia/Perth (UTC+8). */
const RANGE_START = "2026-06-08T01:00:00.000Z";
const RANGE_END = "2026-06-08T09:00:00.000Z";

function workingHours(): Record<string, unknown> {
  return { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } };
}

function freshReadinessInput(
  overrides: Partial<
    import("@/src/lib/workforce-os/workforceReadinessEngine").WorkforceReadinessScoreInput
  > = {}
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
    staff_role: "consultant",
    working_hours: workingHours(),
    hr,
    identityRows,
    compliance,
    now: NOW,
    ...overrides,
  };
}

function block(
  overrides: Partial<StaffAvailabilityBlockRecord> &
    Pick<StaffAvailabilityBlockRecord, "block_type">
): StaffAvailabilityBlockRecord {
  return {
    id: overrides.id ?? "block-1",
    block_type: overrides.block_type,
    starts_at: overrides.starts_at ?? "2026-06-08T00:00:00.000Z",
    ends_at: overrides.ends_at ?? "2026-06-08T10:00:00.000Z",
    status: overrides.status ?? "active",
    reason: overrides.reason ?? null,
  };
}

function shift(overrides: Partial<StaffShiftRecord> = {}): StaffShiftRecord {
  return {
    id: overrides.id ?? "shift-1",
    shift_type: overrides.shift_type ?? "clinic_day",
    starts_at: overrides.starts_at ?? RANGE_START,
    ends_at: overrides.ends_at ?? RANGE_END,
    status: overrides.status ?? "scheduled",
  };
}

test("normalizeRequiredRoles coerces and filters invalid entries", () => {
  assert.deepEqual(normalizeRequiredRoles({ surgeon: 1, nurse: "2", bad: 0 }), {
    surgeon: 1,
    nurse: 2,
  });
});

test("resolveClinicalStaffingTemplate prefers clinic-specific template", () => {
  const templates: ClinicalStaffingTemplateRecord[] = [
    {
      id: "t1",
      tenant_id: "tenant",
      clinic_id: null,
      event_type: "surgery",
      required_roles: { surgeon: 1 },
      is_active: true,
    },
    {
      id: "t2",
      tenant_id: "tenant",
      clinic_id: "clinic-a",
      event_type: "surgery",
      required_roles: { surgeon: 2, nurse: 2 },
      is_active: true,
    },
  ];
  const resolved = resolveClinicalStaffingTemplate({
    eventType: "surgery",
    clinicId: "clinic-a",
    templates,
  });
  assert.equal(resolved?.id, "t2");
});

test("resolveClinicalStaffingTemplate falls back to tenant-wide template", () => {
  const templates: ClinicalStaffingTemplateRecord[] = [
    {
      id: "t1",
      tenant_id: "tenant",
      clinic_id: null,
      event_type: "consultation",
      required_roles: { consultant: 1 },
      is_active: true,
    },
  ];
  const resolved = resolveClinicalStaffingTemplate({
    eventType: "consultation",
    clinicId: "clinic-b",
    templates,
  });
  assert.equal(resolved?.id, "t1");
});

test("detectMissingRoles identifies under-staffed roles", () => {
  const missing = detectMissingRoles({ surgeon: 1, nurse: 2 }, { surgeon: 1, nurse: 1 });
  assert.deepEqual(missing, [{ role: "nurse", required: 2, assigned: 1 }]);
});

test("countAssignedRoles aggregates by role", () => {
  assert.deepEqual(
    countAssignedRoles([
      { assignedRole: "Nurse" },
      { assignedRole: "nurse" },
      { assignedRole: "surgeon" },
    ]),
    { nurse: 2, surgeon: 1 }
  );
});

test("getStaffAvailabilityForRange is available within working hours", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [],
    shifts: [shift()],
  });
  assert.equal(result.available, true);
  assert.equal(result.matchingShifts.length, 1);
});

test("getStaffAvailabilityForRange blocks on leave", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ block_type: "leave" })],
    shifts: [],
  });
  assert.equal(result.available, false);
  assert.ok(result.reasons.some((r) => r.includes("leave")));
});

test("getStaffAvailabilityForRange ignores cancelled blocks", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [block({ block_type: "leave", status: "cancelled" })],
    shifts: [],
  });
  assert.equal(result.available, true);
});

test("getStaffAvailabilityForRange respects available_override", () => {
  const result = getStaffAvailabilityForRange({
    staffId: "staff-1",
    startsAt: "2026-06-09T01:00:00.000Z",
    endsAt: "2026-06-09T02:00:00.000Z",
    workingHours: workingHours(),
    staffTimezone: "Australia/Perth",
    availabilityBlocks: [
      block({
        block_type: "available_override",
        starts_at: "2026-06-09T00:00:00.000Z",
        ends_at: "2026-06-09T04:00:00.000Z",
      }),
    ],
    shifts: [],
  });
  assert.equal(result.available, true);
});

test("detectStaffSchedulingConflicts detects leave and shift overlap", () => {
  const conflicts = detectStaffSchedulingConflicts({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    availabilityBlocks: [block({ block_type: "sick_leave", id: "sick-1" })],
    shifts: [shift({ id: "shift-1" })],
    eventAssignments: [],
  });
  assert.ok(conflicts.some((c) => c.kind === "sick_leave_block"));
  assert.ok(conflicts.some((c) => c.kind === "shift_overlap"));
});

test("detectStaffSchedulingConflicts ignores cancelled shifts and blocks", () => {
  const conflicts = detectStaffSchedulingConflicts({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    availabilityBlocks: [block({ block_type: "leave", status: "cancelled" })],
    shifts: [shift({ status: "cancelled" })],
    eventAssignments: [],
  });
  assert.equal(conflicts.length, 0);
});

test("detectStaffSchedulingConflicts detects assignment overlap via snapshot window", () => {
  const assignments: StaffEventAssignmentRecord[] = [
    {
      id: "a1",
      staff_id: "staff-1",
      assigned_role: "consultant",
      assignment_status: "scheduled",
      event_source: "manual",
      starts_at: RANGE_START,
      ends_at: RANGE_END,
    },
  ];
  const conflicts = detectStaffSchedulingConflicts({
    staffId: "staff-1",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    availabilityBlocks: [],
    shifts: [],
    eventAssignments: assignments,
  });
  assert.ok(conflicts.some((c) => c.kind === "assignment_overlap"));
});

test("validateClinicalEventStaffing reports missing roles", () => {
  const readinessInput = freshReadinessInput();
  const result = validateClinicalEventStaffing({
    eventType: "surgery",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    requiredRoles: { surgeon: 1, nurse: 2 },
    candidateAssignments: [{ staffId: "s1", assignedRole: "nurse", readinessInput }],
    availabilityByStaff: new Map([
      [
        "s1",
        {
          staffId: "s1",
          startsAt: RANGE_START,
          endsAt: RANGE_END,
          workingHours: workingHours(),
          staffTimezone: "Australia/Perth",
          availabilityBlocks: [],
          shifts: [],
        },
      ],
    ]),
    conflictsByStaff: new Map([["s1", []]]),
  });
  assert.equal(result.ready, false);
  assert.ok(result.missingRoles.some((m) => m.role === "surgeon"));
});

test("validateClinicalEventStaffing blocks clinically ineligible staff", () => {
  const readinessInput = freshReadinessInput({ is_active: false });
  const result = validateClinicalEventStaffing({
    eventType: "consultation",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    requiredRoles: { consultant: 1 },
    candidateAssignments: [{ staffId: "s1", assignedRole: "consultant", readinessInput }],
    availabilityByStaff: new Map(),
    conflictsByStaff: new Map([["s1", []]]),
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockedAssignments.some((b) => b.staffId === "s1"));
});

test("assignStaffToClinicalEvent blocks ineligible staff without override", () => {
  const result = assignStaffToClinicalEvent({
    tenantId: "tenant",
    eventSource: "manual",
    staffId: "s1",
    assignedRole: "consultant",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    readinessInput: freshReadinessInput({ is_active: false }),
    conflicts: [],
  });
  assert.equal(result.ok, false);
});

test("assignStaffToClinicalEvent creates blocked draft with allowBlockedDraft", () => {
  const result = assignStaffToClinicalEvent({
    tenantId: "tenant",
    eventSource: "manual",
    staffId: "s1",
    assignedRole: "consultant",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    readinessInput: freshReadinessInput({ is_active: false }),
    conflicts: [],
    allowBlockedDraft: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.assignmentStatus, "blocked");
    assert.equal(result.eligibilitySnapshot.eligible, false);
    assert.ok(Array.isArray(result.warnings));
  }
});

test("assignStaffToClinicalEvent stores readiness snapshot for eligible staff", () => {
  const result = assignStaffToClinicalEvent({
    tenantId: "tenant",
    eventSource: "surgery",
    staffId: "s1",
    assignedRole: "surgeon",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    readinessInput: freshReadinessInput(),
    conflicts: [],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.assignmentStatus, "scheduled");
    assert.equal(result.readiness.score, result.eligibilitySnapshot.score);
    assert.equal(result.eligibilitySnapshot.event_starts_at, RANGE_START);
    assert.equal(result.eligibilitySnapshot.event_ends_at, RANGE_END);
    assert.ok(result.warnings.length >= 0);
  }
});

test("assignStaffToClinicalEvent preserves warnings on snapshot path", () => {
  const readinessInput = freshReadinessInput({
    working_hours: {},
  });
  const result = assignStaffToClinicalEvent({
    tenantId: "tenant",
    eventSource: "manual",
    staffId: "s1",
    assignedRole: "consultant",
    startsAt: RANGE_START,
    endsAt: RANGE_END,
    readinessInput,
    conflicts: [{ kind: "shift_overlap", message: "Overlapping shift (clinic_day)" }],
    allowBlockedDraft: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.assignmentStatus, "blocked");
    assert.ok(result.warnings.some((w) => w.includes("Overlapping shift")));
  }
});
