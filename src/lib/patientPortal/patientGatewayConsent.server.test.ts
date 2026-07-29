import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPatientGatewayConsent,
  parsePatientGatewayConsentRequest,
  PATIENT_GATEWAY_CONSENT_SOURCE,
  PATIENT_GATEWAY_CONSENT_TYPE,
  recordPatientGatewayConsent,
} from "./patientGatewayConsent.server";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const CTX: PatientGatewayContext = {
  authUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  patientId: "11111111-1111-4111-8111-111111111111",
  tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

describe("patientGatewayConsent.server", () => {
  it("GET returns required + unsatisfied when gate requires consent", async () => {
    const status = await getPatientGatewayConsent(CTX, {
      writeAudit: false,
      loadGateStatus: async () => ({
        required: true,
        satisfied: false,
        patientId: CTX.patientId,
      }),
    });
    assert.deepEqual(status, { ok: true, required: true, satisfied: false });
  });

  it("POST records attestation when required and missing", async () => {
    let recorded = false;
    const result = await recordPatientGatewayConsent(CTX, {
      writeAudit: false,
      loadGateStatus: async () => ({
        required: true,
        satisfied: recorded,
        patientId: CTX.patientId,
      }),
      recordAttestation: async () => {
        recorded = true;
        return { documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.required, true);
    assert.equal(result.satisfied, true);
    assert.equal(recorded, true);
  });

  it("POST is idempotent when already satisfied", async () => {
    let calls = 0;
    const result = await recordPatientGatewayConsent(CTX, {
      writeAudit: false,
      loadGateStatus: async () => ({
        required: true,
        satisfied: true,
        patientId: CTX.patientId,
      }),
      recordAttestation: async () => {
        calls += 1;
        return { documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.satisfied, true);
    assert.equal(calls, 0);
  });

  it("POST is a no-op when consent is not required", async () => {
    let calls = 0;
    const result = await recordPatientGatewayConsent(CTX, {
      writeAudit: false,
      loadGateStatus: async () => ({
        required: false,
        satisfied: false,
        patientId: CTX.patientId,
      }),
      recordAttestation: async () => {
        calls += 1;
        return { documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.required, false);
    assert.equal(result.satisfied, true);
    assert.equal(calls, 0);
  });

  it("POST returns misconfigured when attestation write fails", async () => {
    const result = await recordPatientGatewayConsent(CTX, {
      writeAudit: false,
      loadGateStatus: async () => ({
        required: true,
        satisfied: false,
        patientId: CTX.patientId,
      }),
      recordAttestation: async () => {
        throw new Error("storage failed");
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "misconfigured");
    assert.equal(result.status, 500);
  });

  it("parse accepts empty body and canonical type/version", () => {
    const empty = parsePatientGatewayConsentRequest(null);
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    assert.equal(empty.consentType, PATIENT_GATEWAY_CONSENT_TYPE);
    assert.equal(empty.consentVersion, PATIENT_GATEWAY_CONSENT_SOURCE);

    const ok = parsePatientGatewayConsentRequest({
      consentType: PATIENT_GATEWAY_CONSENT_TYPE,
      consentVersion: PATIENT_GATEWAY_CONSENT_SOURCE,
    });
    assert.equal(ok.ok, true);
  });

  it("parse rejects unsupported consent type/version", () => {
    const badType = parsePatientGatewayConsentRequest({ consentType: "marketing" });
    assert.equal(badType.ok, false);
    if (badType.ok) return;
    assert.equal(badType.code, "invalid_category");

    const badVersion = parsePatientGatewayConsentRequest({
      consentVersion: "v999",
    });
    assert.equal(badVersion.ok, false);
    if (badVersion.ok) return;
    assert.equal(badVersion.code, "invalid_category");
  });

  it("parse rejects client-supplied patientId/tenantId", () => {
    const denied = parsePatientGatewayConsentRequest({
      patientId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.code, "ownership_denied");
    assert.equal(denied.status, 403);
  });
});
