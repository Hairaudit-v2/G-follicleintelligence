import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNotificationDedupeKey,
  buildSafePushDataPayload,
  fingerprintProviderToken,
  isValidExpoPushToken,
  validateRegisterPatientDeviceInput,
} from "./patientGatewayDeviceCore";

describe("patientGatewayDeviceCore", () => {
  it("A/B/C. registration validates token without patient/tenant identity fields", () => {
    const ok = validateRegisterPatientDeviceInput({
      platform: "android",
      provider: "expo",
      token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      appVersion: "1.0.0",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.platform, "android");
      assert.equal(ok.provider, "expo");
      assert.equal(ok.tokenFingerprint.length, 64);
      assert.equal(ok.appVersion, "1.0.0");
    }
  });

  it("rejects invalid expo token format", () => {
    const bad = validateRegisterPatientDeviceInput({
      platform: "android",
      provider: "expo",
      token: "not-a-token",
    });
    assert.equal(bad.ok, false);
  });

  it("G. token fingerprint is stable and does not expose raw token", () => {
    const a = fingerprintProviderToken("ExponentPushToken[abc]");
    const b = fingerprintProviderToken("ExponentPushToken[abc]");
    const c = fingerprintProviderToken("ExponentPushToken[xyz]");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.ok(!a.includes("ExponentPushToken"));
  });

  it("accepts ExpoPushToken alias", () => {
    assert.equal(isValidExpoPushToken("ExpoPushToken[hello]"), true);
  });

  it("safe push data excludes identity and clinical fields", () => {
    const data = buildSafePushDataPayload({
      eventType: "new_message",
      resourceId: "thread-1",
    });
    assert.equal(data.eventType, "new_message");
    assert.equal(data.resourceId, "thread-1");
    assert.equal("patientId" in data, false);
    assert.equal("tenantId" in data, false);
    assert.equal("body" in data, false);
  });

  it("AA. dedupe key includes event + source + version", () => {
    const key = buildNotificationDedupeKey({
      eventType: "new_message",
      sourceEntity: "msg-1",
      stateVersion: "v1",
    });
    assert.equal(key, "new_message:msg-1:v1");
  });
});
