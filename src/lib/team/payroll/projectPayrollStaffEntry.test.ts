/**
 * Team payroll identity composition tests (FI-TEAM-COHESION-B1.8A).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  derivePayrollActionFlags,
  isPayrollIdentityTargetUncertain,
  mapWageRateTypeToPayBasis,
  PAYROLL_IDENTITY_KPI_SOURCE_SNAPSHOT,
  projectPayrollStaffEntry,
} from "@/src/lib/team/payroll";
import { assertUsablePayrollIdentityTarget } from "@/src/lib/team/payroll/payrollIdentityMutationGate.server";

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
    capabilities: [],
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

test("linked active staff project normal payroll-ready entry", () => {
  const entry = projectPayrollStaffEntry(identity(), {
    wageProfileId: "wage-1",
    rateType: "hourly",
    canEditPayrollProfile: true,
    canApproveTimesheet: true,
  });
  assert.equal(entry.payroll.payrollReady, true);
  assert.equal(entry.payroll.payBasis, "hourly");
  assert.equal(entry.actions.canEditPayrollProfile, true);
  assert.equal(entry.actions.canApproveTimesheet, true);
  assert.ok(!entry.attentionReasons.includes("missing_wage_profile"));
});

test("missing wage profile yields attention without inventing a rate", () => {
  const entry = projectPayrollStaffEntry(identity(), {
    wageProfileId: null,
    rateType: null,
  });
  assert.equal(entry.payroll.payrollReady, false);
  assert.equal(entry.payroll.payBasis, "unknown");
  assert.ok(entry.attentionReasons.includes("missing_wage_profile"));
});

test("daily wage rate maps to salary presentation alias", () => {
  assert.equal(mapWageRateTypeToPayBasis("daily"), "salary");
  assert.equal(mapWageRateTypeToPayBasis("contractor"), "contractor");
});

test("scheduling-only historical shifts: attribution warning, no payroll edit", () => {
  const id = identity({
    personKey: "fs:33333333-3333-3333-3333-333333333333",
    staffMemberId: null,
    integrity: {
      linkStatus: "scheduling_only",
      hasSchedulingRecord: true,
      hasLifecycleRecord: false,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const entry = projectPayrollStaffEntry(id, {
    wageProfileId: null,
    rateType: null,
    historicalAttributionOnly: true,
  });
  assert.equal(entry.actions.canEditPayrollProfile, false);
  assert.equal(entry.actions.canApproveTimesheet, false);
  assert.ok(entry.attentionReasons.includes("historical_attribution_only"));
  assert.ok(entry.attentionReasons.includes("lifecycle_record_missing"));
});

test("lifecycle-only with wage setup remains visible and editable when permitted", () => {
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
  const entry = projectPayrollStaffEntry(id, {
    wageProfileId: "wage-2",
    rateType: "daily",
    canEditPayrollProfile: true,
    canApproveTimesheet: true,
  });
  assert.equal(entry.payroll.payrollReady, true);
  assert.equal(entry.payroll.payBasis, "salary");
  assert.equal(entry.actions.canEditPayrollProfile, true);
});

test("suspended login does not by itself block payroll action flags", () => {
  const id = identity({ accessStatus: "suspended" });
  const flags = derivePayrollActionFlags(id, {
    canEditPayrollProfile: true,
    canApproveTimesheet: true,
  });
  assert.equal(flags.canEditPayrollProfile, true);
  assert.equal(flags.canApproveTimesheet, true);
});

test("ambiguous / cross-tenant / invalid suppress mutations", () => {
  for (const linkStatus of ["ambiguous", "cross_tenant_mismatch", "invalid"] as const) {
    const id = identity({
      integrity: {
        linkStatus,
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    });
    assert.equal(isPayrollIdentityTargetUncertain(id), true);
    assert.throws(() => assertUsablePayrollIdentityTarget(id));
    const flags = derivePayrollActionFlags(id, {
      canEditPayrollProfile: true,
      canApproveTimesheet: true,
    });
    assert.equal(flags.canEditPayrollProfile, false);
    assert.equal(flags.canApproveTimesheet, false);
  }
});

test("employment ended surfaces attention while preserving identity separation", () => {
  const entry = projectPayrollStaffEntry(
    identity({ employmentStatus: "terminated" }),
    { wageProfileId: "wage-1", rateType: "hourly", employmentEndDate: "2026-01-01" }
  );
  assert.ok(entry.attentionReasons.includes("employment_ended"));
  assert.equal(entry.identity.integrity.linkStatus, "linked");
});

test("KPI source snapshot remains behaviour-neutral", () => {
  assert.equal(
    PAYROLL_IDENTITY_KPI_SOURCE_SNAPSHOT.totalRosteredLabourCost.definitionChanges,
    false
  );
  assert.equal(
    PAYROLL_IDENTITY_KPI_SOURCE_SNAPSHOT.staffWithoutPayrollSetup.definitionChanges,
    false
  );
});

test("architecture: wage mutations use payroll gate; no dual-table join in payroll package", () => {
  const wage = readFileSync("src/lib/workforce/wageProfile.server.ts", "utf8");
  assert.match(wage, /assertEligiblePayrollIdentityTarget/);
  assert.doesNotMatch(wage, /resolveStaffMemberContext/);

  const loader = readFileSync(
    "src/lib/team/payroll/loadPayrollStaffContext.server.ts",
    "utf8"
  );
  assert.match(loader, /resolveStaffIdentities/);
  assert.doesNotMatch(loader, /loadStaffProfileHub/);
  assert.doesNotMatch(loader, /identity\/internal/);
  assert.doesNotMatch(loader, /\bfi_staff\b/);

  const shift = readFileSync("src/lib/workforce/shiftCostIntelligence.server.ts", "utf8");
  assert.match(shift, /resolveStaffIdentities/);
  assert.match(shift, /by:\s*"staffId"/);
});
