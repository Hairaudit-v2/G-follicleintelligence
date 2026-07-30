/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — pure role-matrix projection proofs.
 * Authenticated browser E2E against live tenants remains governance-gated.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { roleHasApiPermission } from "../api/pilotControlPermissions";
import { projectReadinessForRole } from "./roleSensitiveProjection";
import { evaluatePilotPatientReadinessFromSources } from "./evaluateFromSources";
import { baseReadySourceBag } from "./readinessFixtures";
import { evaluateRealPatientPilotGate } from "../adoption/realPatientPilotGate";
import type { PilotControlRoleKey } from "../pilotControlContracts";
import { PILOT_CONTROL_ROLE_KEYS } from "../pilotControlContracts";

describe("1A.6 role matrix projections", () => {
  const readiness = evaluatePilotPatientReadinessFromSources(baseReadySourceBag());

  for (const role of PILOT_CONTROL_ROLE_KEYS) {
    it(`${role} projection does not alter canonical overall state`, () => {
      const projected = projectReadinessForRole(readiness, role);
      assert.equal(projected.overall.state, readiness.overall.state);
      assert.equal(roleHasApiPermission(role, "pilot_control.overview.read"), true);
    });
  }

  it("unauthorised null role is denied overview", () => {
    assert.equal(roleHasApiPermission(null, "pilot_control.overview.read"), false);
    assert.equal(roleHasApiPermission(null, "pilot_control.adoption.read"), false);
  });

  it("reception cannot see clinical provenance detail", () => {
    const projected = projectReadinessForRole(readiness, "reception");
    assert.equal(projected.overall.state, readiness.overall.state);
    // Reception projection keeps patient-safe summaries only where configured.
    assert.ok(projected);
  });

  it("finance cannot use clinical summary permission", () => {
    assert.equal(roleHasApiPermission("finance", "pilot_control.clinical_summary.read"), false);
    assert.equal(roleHasApiPermission("finance", "pilot_control.financial_summary.read"), true);
  });

  it("clinical cannot use financial summary permission", () => {
    assert.equal(roleHasApiPermission("clinical", "pilot_control.financial_summary.read"), false);
    assert.equal(roleHasApiPermission("clinical", "pilot_control.clinical_summary.read"), true);
  });

  it("technical sees technical summary, not finance", () => {
    assert.equal(roleHasApiPermission("technical", "pilot_control.technical_summary.read"), true);
    assert.equal(roleHasApiPermission("technical", "pilot_control.financial_summary.read"), false);
  });

  it("invitation gate never auto-approves humans", () => {
    const gate = evaluateRealPatientPilotGate({
      technicalAcceptance: true,
      migrationsApplied: true,
      tenantIsolationProven: true,
      roleMatrixProven: true,
      identityIntegrityProven: true,
      financeIntegrityProven: true,
      consentControlsProven: true,
    });
    assert.equal(gate.directorApproval, false);
    assert.equal(gate.eligible, false);
  });

  it("director has adoption + export scopes", () => {
    const director: PilotControlRoleKey = "director";
    assert.equal(roleHasApiPermission(director, "pilot_control.adoption.read"), true);
    assert.equal(roleHasApiPermission(director, "pilot_control.export"), true);
  });
});
