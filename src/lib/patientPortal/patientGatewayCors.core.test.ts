/**
 * Unit checks for patient web CORS allowlist (no wildcard).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPatientGatewayApiPath,
  PATIENT_WEB_PRODUCTION_ORIGIN,
  resolvePatientWebCorsOrigin,
} from "./patientGatewayCors";

describe("patientGatewayCors", () => {
  it("allows the production patient web origin", () => {
    assert.equal(
      resolvePatientWebCorsOrigin(PATIENT_WEB_PRODUCTION_ORIGIN),
      PATIENT_WEB_PRODUCTION_ORIGIN
    );
  });

  it("denies arbitrary origins", () => {
    assert.equal(resolvePatientWebCorsOrigin("https://evil.example"), null);
    assert.equal(resolvePatientWebCorsOrigin("*"), null);
    assert.equal(resolvePatientWebCorsOrigin(null), null);
  });

  it("matches patient gateway API paths only", () => {
    assert.equal(isPatientGatewayApiPath("/api/patient/v1/me"), true);
    assert.equal(isPatientGatewayApiPath("/api/patient/v1/messages/abc"), true);
    assert.equal(isPatientGatewayApiPath("/api/cron/x"), false);
    assert.equal(isPatientGatewayApiPath("/fi-admin"), false);
  });
});
