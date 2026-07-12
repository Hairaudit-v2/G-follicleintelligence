/**
 * Staff-first CRM owner options + seed exclusion tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCrmOwnerAssignablePure,
  buildCrmOwnerDisplayName,
  formatCrmOwnerOptionLabel,
  isSystemOrSeedIdentity,
  resolveCrmAssignableOwners,
} from "@/src/lib/crm/crmAssignableOwners";

test("1. staff preferred/full name is primary label", () => {
  const { displayName, usedEmailFallback } = buildCrmOwnerDisplayName({
    staffFullName: "Paul Green",
    email: "paul.personal@gmail.com",
  });
  assert.equal(displayName, "Paul Green");
  assert.equal(usedEmailFallback, false);
});

test("2. user display name used when staff name absent", () => {
  const { displayName } = buildCrmOwnerDisplayName({
    staffFullName: null,
    userDisplayName: "Alex Operator",
    email: "alex@clinic.com",
  });
  assert.equal(displayName, "Alex Operator");
});

test("3. full email is not primary when name exists", () => {
  const label = formatCrmOwnerOptionLabel({
    full_name: "Paul Green",
    email: "paul.personal@gmail.com",
    staff_role: "Consultant",
  });
  assert.match(label, /Paul Green/);
  assert.ok(!label.startsWith("paul.personal@"));
});

test("4. email local-part fallback only when no name", () => {
  const { displayName, usedEmailFallback } = buildCrmOwnerDisplayName({
    email: "onlyemail@clinic.com",
  });
  assert.equal(displayName, "onlyemail");
  assert.equal(usedEmailFallback, true);
});

test("5. evolved.crm.seed1/2/3 excluded", () => {
  for (const local of ["evolved.crm.seed1", "evolved.crm.seed2", "evolved.crm.seed3"]) {
    assert.equal(
      isSystemOrSeedIdentity({ email: `${local}@evolvedhair.com.au` }),
      true,
      local
    );
  }
});

test("6. smoketest and example.com excluded", () => {
  assert.equal(isSystemOrSeedIdentity({ email: "smoketest@clinic.com" }), true);
  assert.equal(isSystemOrSeedIdentity({ email: "user@example.com" }), true);
});

test("7. legitimate staff email remains included", () => {
  assert.equal(
    isSystemOrSeedIdentity({
      email: "paul@evolvedhair.com.au",
      fullName: "Paul Green",
      staffRole: "consultant",
    }),
    false
  );
});

test("8. legitimate surname Test is not excluded", () => {
  assert.equal(
    isSystemOrSeedIdentity({
      email: "jane.test@clinic.com",
      fullName: "Jane Test",
      staffRole: "nurse",
    }),
    false
  );
});

test("9. resolve is staff-first with name labels and collapses duplicates", () => {
  const r = resolveCrmAssignableOwners({
    staff: [
      {
        staffId: "s1",
        fullName: "Paul Green",
        staffRole: "consultant",
        workEmail: "paul@evolvedhair.com.au",
        fiUserId: "u1",
        isActive: true,
        employmentStatus: "active",
      },
      {
        staffId: "s1-dup",
        fullName: "Paul Green",
        staffRole: "consultant",
        workEmail: "paul@evolvedhair.com.au",
        fiUserId: "u1",
        isActive: false,
        employmentStatus: "terminated",
      },
      {
        staffId: "s-seed",
        fullName: "Seed Bot",
        staffRole: "admin",
        workEmail: "evolved.crm.seed1@evolvedhair.com.au",
        fiUserId: "u-seed",
        isActive: true,
        employmentStatus: "active",
      },
      {
        staffId: "s-inact",
        fullName: "Inactive Person",
        staffRole: "nurse",
        workEmail: "inact@clinic.com",
        fiUserId: "u-inact",
        isActive: false,
        employmentStatus: "inactive",
      },
    ],
    users: [
      { userId: "u1", email: "paul@evolvedhair.com.au", role: "member" },
      { userId: "u-seed", email: "evolved.crm.seed1@evolvedhair.com.au", role: "fi_admin" },
      { userId: "u-inact", email: "inact@clinic.com", role: "member" },
      { userId: "u-op", email: "ops@clinic.com", role: "crm_operator" },
    ],
  });

  const ids = r.options.map((o) => o.userId).sort();
  assert.ok(ids.includes("u1"));
  assert.ok(ids.includes("u-op"));
  assert.ok(!ids.includes("u-seed"));
  assert.ok(!ids.includes("u-inact"));
  assert.equal(r.options.filter((o) => o.userId === "u1").length, 1);

  const paul = r.options.find((o) => o.userId === "u1")!;
  assert.equal(paul.displayName, "Paul Green");
  assert.ok(paul.secondaryLabel?.includes("paul@evolvedhair.com.au"));
});

test("10. on_leave staff retained", () => {
  const r = resolveCrmAssignableOwners({
    staff: [
      {
        staffId: "s-leave",
        fullName: "On Leave",
        staffRole: "consultant",
        workEmail: "leave@clinic.com",
        fiUserId: "u-leave",
        isActive: true,
        employmentStatus: "on_leave",
      },
    ],
    users: [{ userId: "u-leave", email: "leave@clinic.com", role: "member" }],
  });
  assert.equal(r.options.some((o) => o.userId === "u-leave"), true);
});

test("11. mutation pure assert rejects seed and inactive", () => {
  assert.equal(
    assertCrmOwnerAssignablePure({
      userId: "u",
      email: "evolved.crm.seed2@x.com",
      role: "fi_admin",
    }).ok,
    false
  );
  assert.equal(
    assertCrmOwnerAssignablePure({
      userId: "u2",
      email: "a@clinic.com",
      staffRows: [{ isActive: false, employmentStatus: "terminated" }],
    }).ok,
    false
  );
  assert.equal(
    assertCrmOwnerAssignablePure({
      userId: "u3",
      email: "a@clinic.com",
      staffRows: [{ isActive: true, employmentStatus: "active" }],
    }).ok,
    true
  );
});

test("12. shell rows use full_name for UI mapping", () => {
  const r = resolveCrmAssignableOwners({
    staff: [
      {
        staffId: "s",
        fullName: "Named Staff",
        staffRole: "reception",
        workEmail: "named@clinic.com",
        fiUserId: "u",
        isActive: true,
      },
    ],
    users: [{ userId: "u", email: "named@clinic.com", role: "member" }],
  });
  assert.equal(r.shellRows[0]!.full_name, "Named Staff");
  assert.equal(r.shellRows[0]!.id, "u");
});
