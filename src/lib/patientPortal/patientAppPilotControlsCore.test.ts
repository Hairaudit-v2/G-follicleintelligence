import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decidePatientAppAccess,
  isGlobalPatientAppPilotPaused,
  mergePatientAppAccessMetadata,
  mergePatientAppPilotTenantMetadata,
  parsePatientAppAccessState,
  parsePatientAppPilotTenantState,
  PATIENT_APP_PILOT_PAUSED_MESSAGE,
  shouldSuppressPatientAppPush,
} from "./patientAppPilotControlsCore";

describe("patientAppPilotControlsCore", () => {
  it("parses missing tenant metadata as enabled (non-breaking)", () => {
    const state = parsePatientAppPilotTenantState({});
    assert.equal(state.status, "enabled");
  });

  it("parses paused tenant flag", () => {
    const state = parsePatientAppPilotTenantState({
      patient_app_pilot: { status: "paused", reason: "safety" },
    });
    assert.equal(state.status, "paused");
    assert.equal(state.reason, "safety");
  });

  it("parses disabled via enabled:false", () => {
    const state = parsePatientAppPilotTenantState({
      patient_app_pilot: { enabled: false },
    });
    assert.equal(state.status, "disabled");
  });

  it("parses patient withdrawn / deactivated access", () => {
    assert.equal(
      parsePatientAppAccessState({
        patient_app_access: { status: "withdrawn" },
      }).status,
      "withdrawn"
    );
    assert.equal(
      parsePatientAppAccessState({
        patient_app_access: { status: "deactivated" },
      }).status,
      "deactivated"
    );
  });

  it("denies when global or tenant paused", () => {
    const paused = decidePatientAppAccess({
      globalPaused: true,
      tenant: parsePatientAppPilotTenantState({}),
      patient: parsePatientAppAccessState({}),
    });
    assert.equal(paused.ok, false);
    if (!paused.ok) {
      assert.equal(paused.code, "pilot_paused");
      assert.equal(paused.message, PATIENT_APP_PILOT_PAUSED_MESSAGE);
    }

    const tenantPaused = decidePatientAppAccess({
      globalPaused: false,
      tenant: parsePatientAppPilotTenantState({ patient_app_pilot: { status: "paused" } }),
      patient: parsePatientAppAccessState({}),
    });
    assert.equal(tenantPaused.ok, false);
  });

  it("denies withdrawn before tenant pause messaging", () => {
    const decision = decidePatientAppAccess({
      globalPaused: true,
      tenant: parsePatientAppPilotTenantState({ patient_app_pilot: { status: "paused" } }),
      patient: parsePatientAppAccessState({
        patient_app_access: { status: "withdrawn" },
      }),
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.code, "patient_withdrawn");
  });

  it("allows when all switches clear", () => {
    const decision = decidePatientAppAccess({
      globalPaused: false,
      tenant: parsePatientAppPilotTenantState({ patient_app_pilot: { status: "enabled" } }),
      patient: parsePatientAppAccessState({ patient_app_access: { status: "active" } }),
    });
    assert.deepEqual(decision, { ok: true });
  });

  it("merges tenant pause without dropping unrelated metadata", () => {
    const next = mergePatientAppPilotTenantMetadata(
      { keep_me: true, patient_app_pilot: { status: "enabled" } },
      {
        status: "paused",
        reason: "drill",
        updatedBy: "op-1",
        atIso: "2026-07-30T00:00:00.000Z",
      }
    );
    assert.equal(next.keep_me, true);
    const pilot = next.patient_app_pilot as Record<string, unknown>;
    assert.equal(pilot.status, "paused");
    assert.equal(pilot.paused, true);
    assert.equal(pilot.reason, "drill");
  });

  it("merges patient withdraw and defaults invitation reuse blocked", () => {
    const next = mergePatientAppAccessMetadata(
      { other: 1 },
      {
        status: "withdrawn",
        reasonCategory: "patient_request",
        changedBy: "clinic-owner",
        atIso: "2026-07-30T01:00:00.000Z",
      }
    );
    assert.equal(next.other, 1);
    const access = next.patient_app_access as Record<string, unknown>;
    assert.equal(access.status, "withdrawn");
    assert.equal(access.invitation_reuse_blocked, true);
    assert.equal(access.reason_category, "patient_request");
  });

  it("suppresses push when access denied", () => {
    assert.equal(
      shouldSuppressPatientAppPush({
        globalPaused: false,
        tenant: parsePatientAppPilotTenantState({ patient_app_pilot: { status: "paused" } }),
        patient: parsePatientAppAccessState({}),
      }),
      true
    );
    assert.equal(
      shouldSuppressPatientAppPush({
        globalPaused: false,
        tenant: parsePatientAppPilotTenantState({}),
        patient: parsePatientAppAccessState({}),
      }),
      false
    );
  });

  it("reads global pause env values", () => {
    assert.equal(isGlobalPatientAppPilotPaused({}), false);
    assert.equal(isGlobalPatientAppPilotPaused({ FI_PATIENT_APP_PILOT_GLOBAL: "paused" }), true);
    assert.equal(isGlobalPatientAppPilotPaused({ FI_PATIENT_APP_PILOT_GLOBAL: "on" }), false);
  });
});
