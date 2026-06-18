import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RECEPTION_SMS_SAFE_LENGTH,
  validateReceptionCommunicationSafety,
} from "@/src/lib/receptionOs/receptionCommunicationSafety";

describe("receptionCommunicationSafety", () => {
  const base = {
    channel: "sms" as const,
    templateKey: "deposit_reminder",
    body: "Hello",
    toAddress: "+61400000000",
    leadId: "22222222-2222-4222-8222-222222222222",
    patientId: null,
  };

  it("accepts a valid sms payload", () => {
    const result = validateReceptionCommunicationSafety(base);
    assert.equal(result.ok, true);
  });

  it("blocks missing template key", () => {
    const result = validateReceptionCommunicationSafety({ ...base, templateKey: null });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /Template key/i);
  });

  it("blocks invalid tenant template key", () => {
    const result = validateReceptionCommunicationSafety({ ...base, templateKey: "not_a_template" });
    assert.equal(result.ok, false);
  });

  it("blocks missing patient and lead", () => {
    const result = validateReceptionCommunicationSafety({ ...base, leadId: null, patientId: null });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /patient or lead/i);
  });

  it("blocks missing sms recipient", () => {
    const result = validateReceptionCommunicationSafety({ ...base, toAddress: null });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /SMS recipient/i);
  });

  it("blocks missing email recipient", () => {
    const result = validateReceptionCommunicationSafety({
      ...base,
      channel: "email",
      toAddress: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /Email recipient/i);
  });

  it("blocks sms over safe length unless explicitly allowed", () => {
    const longBody = "x".repeat(RECEPTION_SMS_SAFE_LENGTH + 1);
    const blocked = validateReceptionCommunicationSafety({ ...base, body: longBody });
    assert.equal(blocked.ok, false);

    const allowed = validateReceptionCommunicationSafety({
      ...base,
      body: longBody,
      allowLongSms: true,
    });
    assert.equal(allowed.ok, true);
  });

  it("blocks empty body", () => {
    const result = validateReceptionCommunicationSafety({ ...base, body: "   " });
    assert.equal(result.ok, false);
  });
});
