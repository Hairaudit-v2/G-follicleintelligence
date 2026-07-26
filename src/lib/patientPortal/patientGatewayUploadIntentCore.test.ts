import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertStoragePathMatchesIntent,
  assertUploadIntentOwnedByContext,
  signPatientGatewayUploadIntent,
  verifyPatientGatewayUploadIntent,
} from "./patientGatewayUploadIntentCore";

const SECRET = "test-patient-gateway-upload-intent-secret";
const BASE = {
  intentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  imageId: "11111111-1111-4111-8111-111111111111",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  patientId: "22222222-2222-4222-8222-222222222222",
  authUserId: "33333333-3333-4333-8333-333333333333",
  slot: "front_hairline" as const,
  mimeType: "image/jpeg",
  fileSize: 1024,
  bucket: "patient-images",
  storagePath:
    "tenant/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/patients/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111-gateway-upload.jpg",
};

describe("patientGatewayUploadIntentCore", () => {
  it("signs and verifies a valid intent", () => {
    const now = Date.now();
    const token = signPatientGatewayUploadIntent(BASE, SECRET, now);
    const verified = verifyPatientGatewayUploadIntent(token, SECRET, now);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.payload.imageId, BASE.imageId);
    assert.equal(verified.payload.patientId, BASE.patientId);
  });

  it("J. expired upload intent fails closed", () => {
    const token = signPatientGatewayUploadIntent(
      { ...BASE, exp: Date.now() - 1000 },
      SECRET,
      Date.now()
    );
    const verified = verifyPatientGatewayUploadIntent(token, SECRET, Date.now());
    assert.equal(verified.ok, false);
    if (verified.ok) return;
    assert.equal(verified.reason, "expired");
  });

  it("H. tampered storage path claim fails", () => {
    const now = Date.now();
    const token = signPatientGatewayUploadIntent(BASE, SECRET, now);
    const verified = verifyPatientGatewayUploadIntent(token, SECRET, now);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(
      assertStoragePathMatchesIntent(verified.payload, "tenant/other/patients/x/y.jpg"),
      false
    );
  });

  it("K. intent owned by another patient fails", () => {
    const now = Date.now();
    const token = signPatientGatewayUploadIntent(BASE, SECRET, now);
    const verified = verifyPatientGatewayUploadIntent(token, SECRET, now);
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(
      assertUploadIntentOwnedByContext(verified.payload, {
        authUserId: BASE.authUserId,
        patientId: "99999999-9999-4999-8999-999999999999",
        tenantId: BASE.tenantId,
      }),
      "ownership"
    );
  });
});
