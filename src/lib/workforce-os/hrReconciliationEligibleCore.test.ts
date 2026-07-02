import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isDepartedEmploymentStatus,
  needsHrReconciliation,
} from "@/src/lib/workforce-os/hrReconciliationEligibleCore";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";

function member(status: string): StaffMemberLifecycleRow {
  return {
    id: "m-1",
    tenant_id: "t-1",
    fi_staff_id: "s-1",
    first_name: "A",
    last_name: "B",
    full_name: "A B",
    email: "a@example.com",
    professional_title: null,
    phone: null,
    role_code: "consultant",
    employment_type: null,
    employment_status: status as StaffMemberLifecycleRow["employment_status"],
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

test("departed employment statuses are excluded from HR reconciliation", () => {
  for (const status of ["terminated", "resigned", "contract_ended"] as const) {
    assert.equal(isDepartedEmploymentStatus(status), true);
    assert.equal(needsHrReconciliation(member(status)), false);
  }
});

test("active staff still needs reconciliation when unlinked", () => {
  assert.equal(needsHrReconciliation(member("active")), true);
});
