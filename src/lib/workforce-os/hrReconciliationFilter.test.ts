import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildHrReconciliationMetrics,
  isStaffArchived,
  isStaffHrLinkedForReconciliation,
  needsHrReconciliation,
} from "./hrReconciliationEligibleCore";
import { buildHrReconciliationPageData } from "./hrReconciliationFilterCore";
import type { StaffMemberLifecycleRow } from "./staffLifecycleTypes";
import { IIOHR_EVOLVED_HR_SOURCE_SYSTEM } from "./iiohrStaffHrLinkReconciliationTypes";

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

const archivedDemoStaff = lifecycleRow({
  id: "demo-archived-1",
  fi_staff_id: "fs-demo-1",
  full_name: "Demo Nurse",
  email: "demo.nurse@demo.iiohr.local",
  archived_at: "2024-01-01T00:00:00.000Z",
  source_system: null,
  iiohr_staff_record_id: null,
});

const activeLinkedIiohrStaff = lifecycleRow({
  id: "iiohr-linked-1",
  fi_staff_id: "fs-real-1",
  full_name: "Real IIOHR Staff",
  email: "real.staff@clinic.com",
  iiohr_staff_record_id: "00000000-0000-4000-8000-000000000101",
  iiohr_user_id: "00000000-0000-4000-8000-000000000201",
  source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
  source_synced_at: "2025-06-01T12:00:00.000Z",
  identity_source: "iiohr_evolved_hr",
});

const activeUnlinkedRealStaff = lifecycleRow({
  id: "unlinked-real-1",
  fi_staff_id: "fs-real-2",
  full_name: "Unlinked Real Staff",
  email: "unlinked@clinic.com",
});

test("archived unlinked demo staff are excluded from reconciliation queue", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [archivedDemoStaff, activeUnlinkedRealStaff],
    evolvedStaffRecords: [],
  });

  assert.equal(
    pageData.suggestions.some((s) => s.staffMemberId === archivedDemoStaff.id),
    false
  );
  assert.equal(pageData.suggestions.length, 1);
  assert.equal(pageData.suggestions[0]?.staffMemberId, activeUnlinkedRealStaff.id);
  assert.equal(pageData.metrics.archivedExcluded, 1);
  assert.equal(pageData.metrics.needsReconciliation, 1);
});

test("active linked IIOHR staff do not generate no-match suggestions", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [activeLinkedIiohrStaff, activeUnlinkedRealStaff],
    evolvedStaffRecords: [],
  });

  assert.equal(
    pageData.suggestions.some((s) => s.staffMemberId === activeLinkedIiohrStaff.id),
    false
  );
  assert.equal(pageData.metrics.alreadyLinked, 1);
  assert.equal(pageData.metrics.needsReconciliation, 1);
});

test("active unlinked real staff may generate reconciliation suggestions", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [activeUnlinkedRealStaff],
    evolvedStaffRecords: [
      {
        id: "iiohr-match-1",
        email: "unlinked@clinic.com",
        full_name: "Unlinked Real Staff",
      },
    ],
  });

  assert.equal(pageData.suggestions.length, 1);
  assert.equal(pageData.suggestions[0]?.matchType, "exact_email");
  assert.equal(pageData.suggestions[0]?.canAutoApprove, true);
});

test("totals do not count archived staff as unresolved", () => {
  const metrics = buildHrReconciliationMetrics([
    archivedDemoStaff,
    activeLinkedIiohrStaff,
    activeUnlinkedRealStaff,
  ]);

  assert.equal(metrics.activeStaff, 2);
  assert.equal(metrics.alreadyLinked, 1);
  assert.equal(metrics.needsReconciliation, 1);
  assert.equal(metrics.archivedExcluded, 1);
});

test("isStaffHrLinkedForReconciliation accepts iiohr_user_id without staff record id", () => {
  assert.equal(
    isStaffHrLinkedForReconciliation({
      iiohr_staff_record_id: null,
      iiohr_user_id: "user-only-link",
      source_system: null,
      source_synced_at: null,
    }),
    true
  );
});

test("isStaffHrLinkedForReconciliation accepts source_system sync without record id", () => {
  assert.equal(
    isStaffHrLinkedForReconciliation({
      iiohr_staff_record_id: null,
      iiohr_user_id: null,
      source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
      source_synced_at: "2025-01-01T00:00:00.000Z",
    }),
    true
  );
});

test("needsHrReconciliation excludes archived and linked staff", () => {
  assert.equal(needsHrReconciliation(archivedDemoStaff), false);
  assert.equal(needsHrReconciliation(activeLinkedIiohrStaff), false);
  assert.equal(needsHrReconciliation(activeUnlinkedRealStaff), true);
});

test("isStaffArchived treats empty archived_at as active", () => {
  assert.equal(isStaffArchived({ archived_at: null }), false);
  assert.equal(isStaffArchived({ archived_at: "" }), false);
  assert.equal(isStaffArchived({ archived_at: "2024-01-01T00:00:00.000Z" }), true);
});

test("archived historical records are listed separately from action queue", () => {
  const pageData = buildHrReconciliationPageData({
    staffMembers: [archivedDemoStaff],
    evolvedStaffRecords: [],
  });

  assert.equal(pageData.suggestions.length, 0);
  assert.equal(pageData.archivedHistorical.length, 1);
  assert.equal(pageData.archivedHistorical[0]?.fiOsEmail, "demo.nurse@demo.iiohr.local");
});
