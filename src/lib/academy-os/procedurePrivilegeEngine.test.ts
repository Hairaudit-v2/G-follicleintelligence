import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluateProcedurePrivilegeEligibility,
  evaluateRoleProcedureRequirements,
  findMatchingProcedurePrivilege,
  isPrivilegeActiveAtDate,
  resolvePrivilegeStatus,
} from "@/src/lib/academy-os/procedurePrivilegeEngine";
import type {
  FiProcedurePrivilegeRequirementRow,
  FiStaffProcedurePrivilegeRow,
} from "@/src/lib/academy-os/procedurePrivilegeTypes";
import { comparePrivilegeLevels, doesPrivilegeLevelSatisfy } from "@/src/lib/academy-os/procedurePrivilegeTypes";

const NOW = new Date("2026-06-22T12:00:00.000Z");

function privilege(
  overrides: Partial<FiStaffProcedurePrivilegeRow> & Pick<FiStaffProcedurePrivilegeRow, "procedureKey">
): FiStaffProcedurePrivilegeRow {
  return {
    id: overrides.id ?? "priv-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    clinicId: overrides.clinicId ?? null,
    staffId: overrides.staffId ?? "staff-1",
    procedureKey: overrides.procedureKey,
    privilegeLevel: overrides.privilegeLevel ?? "assist",
    privilegeStatus: overrides.privilegeStatus ?? "active",
    sourceSystem: overrides.sourceSystem ?? "fi_os",
    sourceCompetencyKey: overrides.sourceCompetencyKey ?? null,
    sourceProjectionId: overrides.sourceProjectionId ?? null,
    grantedBy: overrides.grantedBy ?? null,
    grantedAt: overrides.grantedAt ?? "2026-01-01T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? null,
    reviewedAt: overrides.reviewedAt ?? null,
    reviewDueAt: overrides.reviewDueAt ?? null,
    restrictionReason: overrides.restrictionReason ?? null,
    notes: overrides.notes ?? null,
    metadata: overrides.metadata ?? {},
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function requirement(
  overrides: Partial<FiProcedurePrivilegeRequirementRow> &
    Pick<FiProcedurePrivilegeRequirementRow, "requiredProcedureKey" | "assignedRole">
): FiProcedurePrivilegeRequirementRow {
  return {
    id: overrides.id ?? "req-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    clinicId: overrides.clinicId ?? null,
    eventType: overrides.eventType ?? "surgery",
    assignedRole: overrides.assignedRole,
    requiredProcedureKey: overrides.requiredProcedureKey,
    minimumPrivilegeLevel: overrides.minimumPrivilegeLevel ?? "assist",
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

test("privilege level ordering satisfies hierarchy", () => {
  assert.equal(comparePrivilegeLevels("observe", "assist"), -1);
  assert.equal(comparePrivilegeLevels("perform_independent", "assist"), 2);
  assert.ok(doesPrivilegeLevelSatisfy("perform_independent", "assist"));
  assert.ok(!doesPrivilegeLevelSatisfy("assist", "perform_independent"));
});

test("resolvePrivilegeStatus marks expired privileges", () => {
  assert.equal(
    resolvePrivilegeStatus({
      privilegeStatus: "active",
      expiresAt: "2026-06-01T00:00:00.000Z",
      at: NOW,
    }),
    "expired"
  );
});

test("isPrivilegeActiveAtDate accepts active and pending_review", () => {
  assert.ok(isPrivilegeActiveAtDate({ privilegeStatus: "active", expiresAt: null }, NOW));
  assert.ok(isPrivilegeActiveAtDate({ privilegeStatus: "pending_review", expiresAt: null }, NOW));
  assert.ok(!isPrivilegeActiveAtDate({ privilegeStatus: "suspended", expiresAt: null }, NOW));
});

test("findMatchingProcedurePrivilege prefers clinic-specific privilege", () => {
  const tenantWide = privilege({ procedureKey: "graft_sorting", clinicId: null, privilegeLevel: "assist" });
  const clinicSpecific = privilege({
    id: "priv-clinic",
    procedureKey: "graft_sorting",
    clinicId: "clinic-a",
    privilegeLevel: "perform_supervised",
  });

  const match = findMatchingProcedurePrivilege({
    privileges: [tenantWide, clinicSpecific],
    procedureKey: "graft_sorting",
    clinicId: "clinic-a",
    minimumLevel: "assist",
    at: NOW,
  });

  assert.equal(match.privilege?.id, "priv-clinic");
  assert.equal(match.usedTenantWideFallback, false);
});

test("findMatchingProcedurePrivilege falls back to tenant-wide privilege", () => {
  const tenantWide = privilege({ procedureKey: "fue_extraction", clinicId: null, privilegeLevel: "perform_independent" });

  const match = findMatchingProcedurePrivilege({
    privileges: [tenantWide],
    procedureKey: "fue_extraction",
    clinicId: "clinic-a",
    minimumLevel: "assist",
    at: NOW,
  });

  assert.equal(match.privilege?.id, tenantWide.id);
  assert.equal(match.usedTenantWideFallback, true);
});

test("expired privilege blocks eligibility", () => {
  const result = evaluateProcedurePrivilegeEligibility({
    privileges: [
      privilege({
        procedureKey: "fue_extraction",
        expiresAt: "2026-06-01T00:00:00.000Z",
        privilegeLevel: "perform_independent",
      }),
    ],
    procedureKey: "fue_extraction",
    minimumLevel: "assist",
    at: NOW,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.status, "expired");
});

test("suspended privilege blocks eligibility", () => {
  const result = evaluateProcedurePrivilegeEligibility({
    privileges: [privilege({ procedureKey: "fue_extraction", privilegeStatus: "suspended" })],
    procedureKey: "fue_extraction",
    minimumLevel: "assist",
    at: NOW,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.status, "suspended");
});

test("insufficient privilege level blocks eligibility", () => {
  const result = evaluateProcedurePrivilegeEligibility({
    privileges: [privilege({ procedureKey: "fue_extraction", privilegeLevel: "observe" })],
    procedureKey: "fue_extraction",
    minimumLevel: "perform_independent",
    at: NOW,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.status, "insufficient_level");
});

test("evaluateRoleProcedureRequirements uses OR across multiple procedure keys", () => {
  const result = evaluateRoleProcedureRequirements({
    privileges: [privilege({ procedureKey: "donor_assessment", privilegeLevel: "perform_independent" })],
    requirements: [
      requirement({ assignedRole: "surgeon", requiredProcedureKey: "hairline_design", minimumPrivilegeLevel: "perform_independent" }),
      requirement({ id: "req-2", assignedRole: "surgeon", requiredProcedureKey: "donor_assessment", minimumPrivilegeLevel: "perform_independent" }),
    ],
    assignedRole: "surgeon",
    at: NOW,
  });

  assert.equal(result.eligible, true);
  assert.equal(result.status, "eligible");
});

test("no requirement configured returns warning not block", () => {
  const result = evaluateRoleProcedureRequirements({
    privileges: [],
    requirements: [],
    assignedRole: "surgeon",
    at: NOW,
  });

  assert.equal(result.eligible, true);
  assert.ok(result.warnings.includes("no_privilege_requirement_configured"));
});
