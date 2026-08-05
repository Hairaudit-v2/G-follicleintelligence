/**
 * Directory projection unit tests (FI-TEAM-COHESION-B1.1).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  deriveStaffDirectoryAttentionReasons,
  projectStaffDirectoryEntry,
  toStaffDirectoryLifecycleSignal,
} from "@/src/lib/team/directory/projectStaffDirectoryEntry";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "sm:44444444-4444-4444-4444-444444444444",
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
    primaryClinicId: null,
    clinicIds: [],
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

test("linked identity has no attention reasons", () => {
  assert.deepEqual(deriveStaffDirectoryAttentionReasons(identity()), []);
});

test("scheduling_only surfaces lifecycle missing + incomplete (still visible)", () => {
  const entry = projectStaffDirectoryEntry(
    identity({
      staffMemberId: null,
      personKey: "fs:33333333-3333-3333-3333-333333333333",
      readinessStatus: "watch",
      integrity: {
        linkStatus: "scheduling_only",
        hasSchedulingRecord: true,
        hasLifecycleRecord: false,
        hasAuthIdentity: false,
        warnings: [],
      },
    })
  );
  assert.ok(entry.attentionReasons.includes("lifecycle_record_missing"));
  assert.ok(entry.attentionReasons.includes("identity_link_incomplete"));
  assert.equal(entry.identity.staffId, "33333333-3333-3333-3333-333333333333");
});

test("ambiguous requires reconciliation", () => {
  const reasons = deriveStaffDirectoryAttentionReasons(
    identity({
      readinessStatus: "watch",
      integrity: {
        linkStatus: "ambiguous",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    })
  );
  assert.deepEqual(reasons, ["identity_requires_reconciliation"]);
});

test("lifecycle signal adapter preserves archived + hrLinked for enrich", () => {
  const signal = toStaffDirectoryLifecycleSignal(
    identity({
      employmentStatus: "active",
      archivedAt: "2026-07-03T09:58:21.854Z",
      hrLinked: true,
    })
  );
  assert.deepEqual(signal, {
    employmentStatus: "active",
    archivedAt: "2026-07-03T09:58:21.854Z",
    hrLinked: true,
  });
});

test("null identity yields null lifecycle signal (missing)", () => {
  assert.equal(toStaffDirectoryLifecycleSignal(null), null);
});
