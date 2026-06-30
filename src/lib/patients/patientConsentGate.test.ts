import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  isGlobalTrialConsentGateEnabled,
  isPatientTrialConsentCaptureAllowed,
  PATIENT_TRIAL_CONSENT_REQUIRED_MESSAGE,
} from "./patientTrialConsentShared";

const ENV_KEY = "FI_TRIAL_REQUIRE_CONSENT_BEFORE_CAPTURE";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("patientTrialConsentShared", () => {
  it("reads global env override", () => {
    assert.equal(isGlobalTrialConsentGateEnabled(), false);
    process.env[ENV_KEY] = "true";
    assert.equal(isGlobalTrialConsentGateEnabled(), true);
    process.env[ENV_KEY] = "0";
    assert.equal(isGlobalTrialConsentGateEnabled(), false);
  });

  it("isPatientTrialConsentCaptureAllowed respects gate view", () => {
    assert.equal(isPatientTrialConsentCaptureAllowed({ required: false, satisfied: false }), true);
    assert.equal(isPatientTrialConsentCaptureAllowed({ required: true, satisfied: true }), true);
    assert.equal(isPatientTrialConsentCaptureAllowed({ required: true, satisfied: false }), false);
    assert.equal(isPatientTrialConsentCaptureAllowed(null), true);
  });

  it("exposes operator-facing consent message", () => {
    assert.match(PATIENT_TRIAL_CONSENT_REQUIRED_MESSAGE, /Documents tab/i);
  });
});