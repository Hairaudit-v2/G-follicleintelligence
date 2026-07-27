import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPatientGatewayConsentStatus } from "./patientGatewayConsentCore";

describe("patientGatewayConsentCore", () => {
  it("marks satisfied when consent is not required", () => {
    const status = buildPatientGatewayConsentStatus({ required: false, satisfied: false });
    assert.deepEqual(status, { ok: true, required: false, satisfied: true });
  });

  it("passes through required + satisfied flags", () => {
    assert.deepEqual(buildPatientGatewayConsentStatus({ required: true, satisfied: false }), {
      ok: true,
      required: true,
      satisfied: false,
    });
    assert.deepEqual(buildPatientGatewayConsentStatus({ required: true, satisfied: true }), {
      ok: true,
      required: true,
      satisfied: true,
    });
  });
});
