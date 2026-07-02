import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildReconciliationSuggestions,
  filterProfilePatchForSource,
  isExternallyManagedStaff,
  isOperationallyIneligible,
  isSchedulingExcluded,
  nameSimilarityScore,
  parseStaffEmploymentStatus,
  resolveEditableProfileFields,
  shouldDeactivateOnEmploymentChange,
} from "./staffLifecycleCore";
import { calculateWorkforceReadinessScore } from "./workforceReadinessEngine";
import type { StaffMemberLifecycleRow } from "./staffLifecycleTypes";
import {
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_STATUSES,
  STAFF_LIFECYCLE_AUDIT_EVENTS,
} from "./staffLifecycleTypes";

function lifecycleRow(
  overrides: Partial<StaffMemberLifecycleRow> = {}
): StaffMemberLifecycleRow {
  return {
    id: "sm-1",
    tenant_id: "tenant-1",
    fi_staff_id: "fs-1",
    first_name: "Danica",
    last_name: "Miloseski",
    full_name: "Danica Miloseski",
    email: "danica@example.com",
    professional_title: null,
    phone: null,
    role_code: "nurse",
    employment_type: null,
    employment_status: "active",
    timezone: null,
    clinic_id: null,
    notes: null,
    identity_source: "local",
    internal_tags: [],
    iiohr_staff_record_id: null,
    iiohr_user_id: null,
    source_system: null,
    source_synced_at: null,
    source_snapshot: {},
    archived_at: null,
    employment_status_reason: null,
    employment_status_changed_at: null,
    employment_status_changed_by: null,
    last_manual_profile_update: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

test("local staff profile fields are fully editable", () => {
  const row = lifecycleRow();
  const { locked, editable } = resolveEditableProfileFields(row);
  assert.equal(locked.length, 0);
  assert.ok(editable.includes("email"));
  assert.ok(editable.includes("first_name"));
});

test("IIOHR managed staff locks identity fields", () => {
  const row = lifecycleRow({
    identity_source: "iiohr_evolved_hr",
    source_system: "iiohr_evolved_hr",
  });
  assert.equal(isExternallyManagedStaff(row), true);
  const { locked } = resolveEditableProfileFields(row);
  assert.ok(locked.includes("email"));
  assert.ok(locked.includes("role_code"));
  const patch = filterProfilePatchForSource(row, {
    email: "new@example.com",
    notes: "local note",
    first_name: "Changed",
  });
  assert.equal(patch.email, undefined);
  assert.equal(patch.notes, "local note");
  assert.equal(patch.first_name, undefined);
});

test("employment status transitions deactivate when terminated", () => {
  assert.equal(shouldDeactivateOnEmploymentChange("terminated"), true);
  assert.equal(shouldDeactivateOnEmploymentChange("resigned"), true);
  assert.equal(shouldDeactivateOnEmploymentChange("contract_ended"), true);
  assert.equal(shouldDeactivateOnEmploymentChange("active"), false);
  assert.equal(isOperationallyIneligible("terminated"), true);
  assert.equal(isSchedulingExcluded("on_leave"), true);
  assert.equal(isSchedulingExcluded("suspended"), true);
});

test("parseStaffEmploymentStatus falls back to active", () => {
  assert.equal(parseStaffEmploymentStatus("terminated"), "terminated");
  assert.equal(parseStaffEmploymentStatus("invalid"), "active");
});

test("readiness score is 0 for terminated employment", () => {
  const result = calculateWorkforceReadinessScore({
    is_active: true,
    employment_status: "terminated",
    staff_role: "nurse",
    working_hours: {},
    hr: { hasHrLink: true, isSyncStale: false } as never,
    identityRows: [],
    compliance: { items: [], overallStatus: "current", counts: { current: 0, due_soon: 0, expired: 0, missing: 0, unknown: 0 } },
  });
  assert.equal(result.score, 0);
  assert.equal(result.operationally_ineligible, true);
});

test("readiness blocked warnings for suspended", () => {
  const result = calculateWorkforceReadinessScore({
    is_active: true,
    employment_status: "suspended",
    staff_role: "nurse",
    working_hours: { mon: [{ start: "09:00", end: "17:00" }] },
    hr: { hasHrLink: true, isSyncStale: false } as never,
    identityRows: [{ source_system: "iiohr_hr", source_staff_id: "x", metadata: {} }],
    compliance: { items: [], overallStatus: "current", counts: { current: 0, due_soon: 0, expired: 0, missing: 0, unknown: 0 } },
  });
  assert.equal(result.operationally_ineligible, true);
  assert.ok(result.warnings.includes("employment_suspended"));
});

test("email exact match reconciliation suggestion", () => {
  const suggestions = buildReconciliationSuggestions({
    staffMembers: [lifecycleRow({ email: "ana@example.com", full_name: "Ana Example" })],
    evolvedStaffRecords: [
      { id: "iiohr-1", email: "ana@example.com", full_name: "Ana Example" },
    ],
  });
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.matchType, "exact_email");
  assert.equal(suggestions[0]?.canAutoApprove, true);
  assert.equal(suggestions[0]?.confidenceScore, 100);
});

test("name suggestion only — not auto approvable", () => {
  const suggestions = buildReconciliationSuggestions({
    staffMembers: [lifecycleRow({ email: "danica@clinic.com", full_name: "Danica Miloseski" })],
    evolvedStaffRecords: [
      { id: "iiohr-2", email: "other@example.com", full_name: "Danica Miloseski" },
    ],
  });
  assert.equal(suggestions[0]?.matchType, "name_suggestion");
  assert.equal(suggestions[0]?.canAutoApprove, false);
});

test("blank email skipped from exact match", () => {
  const suggestions = buildReconciliationSuggestions({
    staffMembers: [lifecycleRow({ email: null, full_name: "No Email Staff" })],
    evolvedStaffRecords: [{ id: "iiohr-3", email: "x@example.com", full_name: "No Email Staff" }],
  });
  assert.equal(suggestions[0]?.matchType, "none");
  assert.equal(suggestions[0]?.canAutoApprove, false);
});

test("nameSimilarityScore requires meaningful overlap", () => {
  assert.ok(nameSimilarityScore("Danica Miloseski", "Danica Miloseski") >= 80);
  assert.ok(nameSimilarityScore("Danica Miloseski", "Daniel Bullen") < 60);
});

test("manage employment excludes offboarding centre statuses", () => {
  const manageEmploymentStatuses = STAFF_EMPLOYMENT_STATUSES.filter(
    (status) => !OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES.has(status)
  );
  for (const status of ["terminated", "resigned", "contract_ended"] as const) {
    assert.ok(OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES.has(status));
    assert.ok(!manageEmploymentStatuses.includes(status));
  }
  assert.ok(manageEmploymentStatuses.includes("inactive"));
  assert.ok(manageEmploymentStatuses.includes("on_leave"));
});

test("audit event type constants exist for lifecycle", () => {
  assert.equal(STAFF_LIFECYCLE_AUDIT_EVENTS.PROFILE_UPDATED, "staff_profile_updated");
  assert.equal(STAFF_LIFECYCLE_AUDIT_EVENTS.HR_RECONCILED, "staff_hr_reconciled");
  assert.equal(STAFF_LIFECYCLE_AUDIT_EVENTS.HR_LINKED_MANUALLY, "staff_hr_linked_manually");
});
