/**
 * Roster projection unit tests (FI-TEAM-COHESION-B1.4).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  deriveRosterIdentityActionFlags,
  indexRosterMemberContextByStaffId,
  projectRosterStaffEntry,
  toRosterStaffMemberContext,
} from "@/src/lib/team/roster";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "st:33333333-3333-3333-3333-333333333333",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: null,
    displayName: "Ada",
    email: "ada@example.com",
    employmentStatus: "active",
    accessStatus: "no_login",
    readinessStatus: "ready",
    archivedAt: null,
    hrLinked: false,
    primaryClinicId: "clinic-1",
    clinicIds: ["clinic-1"],
    roles: ["nurse"],
    capabilities: [],
    integrity: {
      linkStatus: "linked",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
    ...overrides,
  };
}

test("linked staff projects with domain eligibility preserved", () => {
  const entry = projectRosterStaffEntry(identity(), {
    domainEligible: true,
    schedulingActive: true,
  });
  assert.ok(entry);
  assert.equal(entry!.scheduling.staffId, "33333333-3333-3333-3333-333333333333");
  assert.equal(entry!.actions.canBeRostered, true);
  assert.equal(entry!.actions.requiresReconciliation, false);
  assert.equal(entry!.attentionReasons.length, 0);
});

test("scheduling-only remains present with lifecycle missing warning", () => {
  const schedulingOnly = identity({
    staffMemberId: null,
    integrity: {
      linkStatus: "scheduling_only",
      hasSchedulingRecord: true,
      hasLifecycleRecord: false,
      hasAuthIdentity: false,
      warnings: [],
    },
  });
  const entry = projectRosterStaffEntry(schedulingOnly, {
    domainEligible: true,
    schedulingActive: true,
  });
  assert.ok(entry);
  assert.ok(entry!.attentionReasons.includes("lifecycle_record_missing"));
  assert.ok(entry!.attentionReasons.includes("identity_link_incomplete"));
  assert.equal(entry!.actions.canBeRostered, true);
  assert.equal(toRosterStaffMemberContext(schedulingOnly), null);
});

test("scheduling-only member bridge leaves employment unset for is_active fallback", () => {
  const member = toRosterStaffMemberContext(
    identity({
      staffMemberId: null,
      integrity: {
        linkStatus: "scheduling_only",
        hasSchedulingRecord: true,
        hasLifecycleRecord: false,
        hasAuthIdentity: false,
        warnings: [],
      },
    })
  );
  assert.equal(member, null);
});

test("lifecycle-only is not a roster resource", () => {
  const entry = projectRosterStaffEntry(
    identity({
      staffId: null,
      personKey: "sm:44444444-4444-4444-4444-444444444444",
      integrity: {
        linkStatus: "lifecycle_only",
        hasSchedulingRecord: false,
        hasLifecycleRecord: true,
        hasAuthIdentity: false,
        warnings: [],
      },
    }),
    { domainEligible: true, schedulingActive: false }
  );
  assert.equal(entry, null);
});

test("ambiguous identity blocks new assignment flags", () => {
  const entry = projectRosterStaffEntry(
    identity({
      integrity: {
        linkStatus: "ambiguous",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    { domainEligible: true, schedulingActive: true }
  );
  assert.ok(entry);
  assert.deepEqual(entry!.attentionReasons, ["identity_requires_reconciliation"]);
  assert.equal(entry!.actions.canBeRostered, false);
  assert.equal(entry!.actions.canEditAssignment, false);
  assert.equal(entry!.actions.requiresReconciliation, true);
});

test("cross-tenant mismatch hard-rejects action flags", () => {
  const flags = deriveRosterIdentityActionFlags(
    identity({
      integrity: {
        linkStatus: "cross_tenant_mismatch",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    true
  );
  assert.equal(flags.canBeRostered, false);
  assert.equal(flags.requiresReconciliation, true);
});

test("member index preserves staffId keys and skips scheduling-only", () => {
  const linked = identity();
  const schedulingOnly = identity({
    staffId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    personKey: "st:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    staffMemberId: null,
    integrity: {
      linkStatus: "scheduling_only",
      hasSchedulingRecord: true,
      hasLifecycleRecord: false,
      hasAuthIdentity: false,
      warnings: [],
    },
  });
  const map = indexRosterMemberContextByStaffId(
    new Map([
      [linked.staffId!, linked],
      [schedulingOnly.staffId!, schedulingOnly],
      ["missing", null],
    ])
  );
  assert.equal(map.size, 1);
  assert.equal(map.get(linked.staffId!)?.employment_status, "active");
  assert.equal(map.has(schedulingOnly.staffId!), false);
});

test("domain ineligible staff stays ineligible in action flags", () => {
  const flags = deriveRosterIdentityActionFlags(identity(), false);
  assert.equal(flags.canBeRostered, false);
  assert.equal(flags.requiresReconciliation, false);
});
