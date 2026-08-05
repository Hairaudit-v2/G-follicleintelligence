/**
 * Team planning identity composition tests (FI-TEAM-COHESION-B1.8B).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  gateProcedureStaffingCandidates,
  isPlanningIdentityTargetUncertain,
  PLANNING_IDENTITY_KPI_SOURCE_SNAPSHOT,
  projectPlanningStaffEntry,
} from "@/src/lib/team/planning";

const TENANT = "11111111-1111-1111-1111-111111111111";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  const base: StaffIdentity = {
    tenantId: TENANT,
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: "55555555-5555-5555-5555-555555555555",
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    employmentStatus: "active",
    accessStatus: "login_active",
    readinessStatus: "ready",
    archivedAt: null,
    hrLinked: false,
    primaryClinicId: "clinic-1",
    clinicIds: ["clinic-1"],
    roles: ["nurse"],
    capabilities: ["grafting"],
    integrity: {
      linkStatus: "linked",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  };
  return {
    ...base,
    ...overrides,
    integrity: {
      ...base.integrity,
      ...(overrides.integrity ?? {}),
    },
  };
}

test("linked clinically ready staff are assignable", () => {
  const entry = projectPlanningStaffEntry(identity(), {
    rosterReady: true,
    clinicalReady: true,
    domainSchedulable: true,
    eligibleRoleIds: ["nurse"],
    procedureCapabilities: ["grafting"],
  });
  assert.equal(entry.availability.schedulable, true);
  assert.equal(entry.actions.canAssignToProcedure, true);
  assert.equal(entry.planning.capacityStatus, "available");
});

test("scheduling-only remains projecting with lifecycle warning", () => {
  const id = identity({
    staffMemberId: null,
    integrity: {
      linkStatus: "scheduling_only",
      hasSchedulingRecord: true,
      hasLifecycleRecord: false,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const entry = projectPlanningStaffEntry(id, {
    rosterReady: true,
    clinicalReady: true,
    domainSchedulable: true,
  });
  assert.equal(entry.availability.schedulable, true);
  assert.ok(entry.attentionReasons.includes("lifecycle_record_missing"));
});

test("lifecycle-only is future capacity only — never schedulable", () => {
  const id = identity({
    staffId: null,
    integrity: {
      linkStatus: "lifecycle_only",
      hasSchedulingRecord: false,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
  });
  const entry = projectPlanningStaffEntry(id, {
    rosterReady: true,
    clinicalReady: true,
    domainSchedulable: true,
  });
  assert.equal(entry.availability.schedulable, false);
  assert.equal(entry.actions.canAssignToProcedure, false);
  assert.ok(entry.attentionReasons.includes("future_capacity_only"));
});

test("ambiguous identity cannot receive procedure assignments", () => {
  const id = identity({
    integrity: {
      linkStatus: "ambiguous",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  assert.equal(isPlanningIdentityTargetUncertain(id), true);
  const entry = projectPlanningStaffEntry(id, {
    rosterReady: true,
    clinicalReady: true,
    domainSchedulable: true,
  });
  assert.equal(entry.actions.canAssignToProcedure, false);
});

test("expired credentials / clinical block retains precedence", () => {
  const entry = projectPlanningStaffEntry(identity(), {
    rosterReady: true,
    clinicalReady: false,
    clinicalBlockers: ["credentials_expired"],
    domainSchedulable: true,
  });
  assert.equal(entry.actions.canAssignToProcedure, false);
  assert.ok(entry.attentionReasons.includes("clinical_readiness_blocked"));
  assert.equal(entry.planning.capacityStatus, "limited");
});

test("procedure staffing bridge blocks unsafe candidates", () => {
  const linked = identity();
  const ambiguous = identity({
    personKey: "sm:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    staffId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    integrity: {
      linkStatus: "ambiguous",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const gates = gateProcedureStaffingCandidates({
    candidateStaffIds: [linked.staffId!, ambiguous.staffId!],
    identitiesByStaffId: new Map([
      [linked.staffId!, linked],
      [ambiguous.staffId!, ambiguous],
    ]),
  });
  assert.equal(gates.find((g) => g.staffId === linked.staffId)?.canAssign, true);
  assert.equal(gates.find((g) => g.staffId === ambiguous.staffId)?.canAssign, false);
});

test("KPI snapshot remains behaviour-neutral", () => {
  assert.equal(PLANNING_IDENTITY_KPI_SOURCE_SNAPSHOT.procedureCapacity.definitionChanges, false);
  assert.equal(PLANNING_IDENTITY_KPI_SOURCE_SNAPSHOT.recruitmentPipeline.definitionChanges, false);
});

test("architecture: planning loader batches identity; candidates stay separate", () => {
  const loader = readFileSync(
    "src/lib/team/planning/loadPlanningStaffContext.server.ts",
    "utf8"
  );
  assert.match(loader, /resolveStaffIdentities/);
  assert.match(loader, /by:\s*"staffId"/);
  assert.match(loader, /PlanningRecruitmentCandidateRef|candidateRefs/);
  assert.doesNotMatch(loader, /identity\/internal/);
  assert.doesNotMatch(loader, /\bfi_staff_members\b/);

  const optimizer = readFileSync(
    "src/lib/workforce/procedureStaffingOptimizer.server.ts",
    "utf8"
  );
  assert.match(optimizer, /gateProcedureStaffingCandidates/);
  assert.match(optimizer, /resolveStaffIdentities/);
});
