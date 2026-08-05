/**
 * Pure unit tests for StaffIdentity integrity / readiness / keys.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffPersonKey } from "@/src/lib/team/identity/staffIdentityKeys";
import { classifyStaffIdentityIntegrity } from "@/src/lib/team/identity/staffIdentityIntegrity";
import {
  deriveStaffAccessStatus,
  deriveStaffReadinessStatus,
} from "@/src/lib/team/identity/staffIdentityReadiness";
import { normaliseStaffIdentity } from "@/src/lib/team/identity/internal/normaliseStaffIdentity";
import type {
  StaffIdentityLifecycleRow,
  StaffIdentitySchedulingRow,
} from "@/src/lib/team/identity/internal/staffIdentityRowTypes";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "22222222-2222-2222-2222-222222222222";
const STAFF_ID = "33333333-3333-3333-3333-333333333333";
const MEMBER_ID = "44444444-4444-4444-4444-444444444444";
const MEMBER_ID_B = "55555555-5555-5555-5555-555555555555";
const USER_ID = "66666666-6666-6666-6666-666666666666";

function scheduling(
  overrides: Partial<StaffIdentitySchedulingRow> = {}
): StaffIdentitySchedulingRow {
  return {
    id: STAFF_ID,
    tenant_id: TENANT,
    fi_user_id: USER_ID,
    full_name: "Ada Staff",
    email: "ada@example.com",
    staff_role: "nurse",
    is_active: true,
    working_hours: {},
    staff_metadata: {},
    ...overrides,
  };
}

function lifecycle(
  overrides: Partial<StaffIdentityLifecycleRow> = {}
): StaffIdentityLifecycleRow {
  return {
    id: MEMBER_ID,
    tenant_id: TENANT,
    fi_staff_id: STAFF_ID,
    full_name: "Ada Member",
    email: "ada@example.com",
    employment_status: "active",
    role_code: "nurse",
    clinic_id: null,
    archived_at: null,
    merged_into: null,
    system_access_revoked: false,
    iiohr_staff_record_id: null,
    iiohr_user_id: null,
    source_system: null,
    source_synced_at: null,
    ...overrides,
  };
}

test("personKey prefers staffMemberId then staffId", () => {
  assert.equal(
    buildStaffPersonKey({ staffId: STAFF_ID, staffMemberId: MEMBER_ID }),
    `sm:${MEMBER_ID}`
  );
  assert.equal(
    buildStaffPersonKey({ staffId: STAFF_ID, staffMemberId: null }),
    `fs:${STAFF_ID}`
  );
  assert.equal(buildStaffPersonKey({ staffId: null, staffMemberId: null }), "invalid");
});

test("integrity: linked when both rows share tenant", () => {
  const result = classifyStaffIdentityIntegrity({
    tenantId: TENANT,
    schedulingTenantId: TENANT,
    lifecycleTenantId: TENANT,
    staffId: STAFF_ID,
    staffMemberId: MEMBER_ID,
    userId: USER_ID,
    hasSchedulingRecord: true,
    hasLifecycleRecord: true,
    lifecycleCandidateCount: 1,
  });
  assert.equal(result.linkStatus, "linked");
  assert.equal(result.hasAuthIdentity, true);
});

test("integrity: scheduling_only", () => {
  const result = classifyStaffIdentityIntegrity({
    tenantId: TENANT,
    schedulingTenantId: TENANT,
    lifecycleTenantId: null,
    staffId: STAFF_ID,
    staffMemberId: null,
    userId: null,
    hasSchedulingRecord: true,
    hasLifecycleRecord: false,
    lifecycleCandidateCount: 0,
  });
  assert.equal(result.linkStatus, "scheduling_only");
  assert.ok(result.warnings.some((w) => w.code === "missing_lifecycle_record"));
});

test("integrity: lifecycle_only", () => {
  const result = classifyStaffIdentityIntegrity({
    tenantId: TENANT,
    schedulingTenantId: null,
    lifecycleTenantId: TENANT,
    staffId: null,
    staffMemberId: MEMBER_ID,
    userId: null,
    hasSchedulingRecord: false,
    hasLifecycleRecord: true,
    lifecycleCandidateCount: 1,
  });
  assert.equal(result.linkStatus, "lifecycle_only");
});

test("integrity: ambiguous when multiple lifecycle candidates", () => {
  const result = classifyStaffIdentityIntegrity({
    tenantId: TENANT,
    schedulingTenantId: TENANT,
    lifecycleTenantId: TENANT,
    staffId: STAFF_ID,
    staffMemberId: MEMBER_ID,
    userId: USER_ID,
    hasSchedulingRecord: true,
    hasLifecycleRecord: true,
    lifecycleCandidateCount: 2,
  });
  assert.equal(result.linkStatus, "ambiguous");
});

test("integrity: cross_tenant_mismatch", () => {
  const result = classifyStaffIdentityIntegrity({
    tenantId: TENANT,
    schedulingTenantId: OTHER_TENANT,
    lifecycleTenantId: TENANT,
    staffId: STAFF_ID,
    staffMemberId: MEMBER_ID,
    userId: null,
    hasSchedulingRecord: false,
    hasLifecycleRecord: true,
    lifecycleCandidateCount: 1,
  });
  assert.equal(result.linkStatus, "cross_tenant_mismatch");
});

test("integrity: invalid broken FK", () => {
  const result = classifyStaffIdentityIntegrity({
    tenantId: TENANT,
    schedulingTenantId: null,
    lifecycleTenantId: TENANT,
    staffId: STAFF_ID,
    staffMemberId: MEMBER_ID,
    userId: null,
    hasSchedulingRecord: false,
    hasLifecycleRecord: true,
    lifecycleCandidateCount: 1,
    brokenStaffFk: true,
  });
  assert.equal(result.linkStatus, "invalid");
});

test("normalise: linked identity carries both ids and clinic from lifecycle", () => {
  const identity = normaliseStaffIdentity({
    tenantId: TENANT,
    scheduling: scheduling(),
    lifecycle: lifecycle({ clinic_id: "clinic-1" }),
    lifecycleCandidates: [lifecycle({ clinic_id: "clinic-1" })],
  });
  assert.equal(identity.integrity.linkStatus, "linked");
  assert.equal(identity.staffId, STAFF_ID);
  assert.equal(identity.staffMemberId, MEMBER_ID);
  assert.equal(identity.userId, USER_ID);
  assert.equal(identity.primaryClinicId, "clinic-1");
  assert.equal(identity.readinessStatus, "ready");
  assert.equal(identity.accessStatus, "login_active");
  assert.equal(identity.archivedAt, null);
  assert.equal(identity.hrLinked, false);
});

test("normalise: archived lifecycle fallback preserves archive signal", () => {
  const archived = lifecycle({
    archived_at: "2026-07-03T09:58:21.854Z",
    iiohr_staff_record_id: "hr-1",
  });
  const identity = normaliseStaffIdentity({
    tenantId: TENANT,
    scheduling: scheduling({ is_active: false }),
    lifecycle: archived,
    lifecycleCandidates: [archived],
  });
  assert.equal(identity.integrity.linkStatus, "linked");
  assert.equal(identity.archivedAt, "2026-07-03T09:58:21.854Z");
  assert.equal(identity.hrLinked, true);
  assert.equal(identity.readinessStatus, "blocked");
});

test("normalise: ambiguous prefers sorted canonical member but surfaces status", () => {
  const a = lifecycle({ id: MEMBER_ID_B, full_name: "B" });
  const b = lifecycle({ id: MEMBER_ID, full_name: "A" });
  const identity = normaliseStaffIdentity({
    tenantId: TENANT,
    scheduling: scheduling(),
    lifecycle: null,
    lifecycleCandidates: [a, b],
  });
  assert.equal(identity.integrity.linkStatus, "ambiguous");
  assert.equal(identity.staffMemberId, MEMBER_ID); // lexicographically first
  assert.equal(identity.readinessStatus, "watch");
});

test("normalise: cross-tenant foreign scheduling tenant", () => {
  const identity = normaliseStaffIdentity({
    tenantId: TENANT,
    scheduling: null,
    lifecycle: lifecycle(),
    lifecycleCandidates: [lifecycle()],
    foreignSchedulingTenantId: OTHER_TENANT,
  });
  assert.equal(identity.integrity.linkStatus, "cross_tenant_mismatch");
  assert.equal(identity.readinessStatus, "blocked");
});

test("access distinguishes suspended employment from revoked flag", () => {
  assert.equal(
    deriveStaffAccessStatus({
      systemAccessRevoked: true,
      employmentStatus: "active",
      userId: USER_ID,
    }),
    "revoked"
  );
  assert.equal(
    deriveStaffAccessStatus({
      systemAccessRevoked: false,
      employmentStatus: "suspended",
      userId: USER_ID,
    }),
    "suspended"
  );
  assert.equal(
    deriveStaffAccessStatus({
      systemAccessRevoked: false,
      employmentStatus: "active",
      userId: null,
    }),
    "no_login"
  );
});

test("readiness: terminated employment is blocked even when linked", () => {
  assert.equal(
    deriveStaffReadinessStatus({
      employmentStatus: "terminated",
      linkStatus: "linked",
    }),
    "blocked"
  );
});

test("readiness: invitation-era lifecycle_only is watch not blocked", () => {
  assert.equal(
    deriveStaffReadinessStatus({
      employmentStatus: "pending_onboarding",
      linkStatus: "lifecycle_only",
    }),
    "watch"
  );
});
