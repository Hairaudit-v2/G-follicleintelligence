import assert from "node:assert/strict";
import test from "node:test";

import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoStaffEmail,
  buildEnterpriseDemoStaffHierarchy,
  validateEnterpriseDemoStaffHierarchy,
} from "./enterpriseDemoStaffHierarchy";

test("buildEnterpriseDemoStaffHierarchy produces 61 nodes (5 global + 7 per clinic)", () => {
  const nodes = buildEnterpriseDemoStaffHierarchy();
  assert.equal(nodes.length, 5 + ENTERPRISE_DEMO_CLINICS.length * 7);
});

test("validateEnterpriseDemoStaffHierarchy accepts generated tree", () => {
  const nodes = buildEnterpriseDemoStaffHierarchy();
  const result = validateEnterpriseDemoStaffHierarchy(nodes);
  assert.equal(result.ok, true);
});

test("every clinic has a lead surgeon reporting to clinic director", () => {
  const nodes = buildEnterpriseDemoStaffHierarchy();
  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const surgeonKey = `${clinic.slug}-lead-surgeon`;
    const directorKey = `${clinic.slug}-clinic-director`;
    const surgeon = nodes.find((n) => n.key === surgeonKey);
    assert.ok(surgeon);
    assert.equal(surgeon.reportsToKey, directorKey);
  }
});

test("global ops director reports to CEO", () => {
  const nodes = buildEnterpriseDemoStaffHierarchy();
  const ops = nodes.find((n) => n.key === "global-ops-director");
  assert.ok(ops);
  assert.equal(ops.reportsToKey, "global-ceo");
});

test("buildEnterpriseDemoStaffEmail is stable and unique per key", () => {
  const nodes = buildEnterpriseDemoStaffHierarchy();
  const emails = new Set(nodes.map((n) => buildEnterpriseDemoStaffEmail(n.key)));
  assert.equal(emails.size, nodes.length);
  assert.match(buildEnterpriseDemoStaffEmail("global-ceo"), /^titan\./);
});
