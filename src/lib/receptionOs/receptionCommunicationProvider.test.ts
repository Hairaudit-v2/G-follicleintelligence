import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DryRunReceptionCommunicationProvider,
  StubReceptionCommunicationProvider,
  sendReceptionCommunication,
  setReceptionCommunicationProvider,
} from "@/src/lib/receptionOs/receptionCommunicationProvider";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setReceptionCommunicationProvider(new StubReceptionCommunicationProvider());
});

describe("receptionCommunicationProvider", () => {
  it("stub provider returns external id without delivering (Phase 4 behaviour)", async () => {
    setReceptionCommunicationProvider(new StubReceptionCommunicationProvider());
    const result = await sendReceptionCommunication({
      tenantId: "22222222-2222-4222-8222-222222222222",
      channel: "sms",
      toAddress: "+61400000000",
      subject: null,
      body: "Hello",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.provider, "stub");
    assert.ok(result.externalMessageId?.startsWith("stub-sms-"));
  });

  it("dry-run provider does not deliver externally", async () => {
    setReceptionCommunicationProvider(new DryRunReceptionCommunicationProvider());
    const result = await sendReceptionCommunication({
      tenantId: "22222222-2222-4222-8222-222222222222",
      channel: "email",
      toAddress: "patient@example.com",
      subject: "Hi",
      body: "Hello",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.provider, "stub");
    assert.ok(result.externalMessageId?.startsWith("dry-run-email-"));
    assert.match(result.detail, /Dry run/i);
  });

  it("rejects empty body", async () => {
    await assert.rejects(() =>
      sendReceptionCommunication({
        tenantId: "22222222-2222-4222-8222-222222222222",
        channel: "email",
        toAddress: "a@b.com",
        subject: "Hi",
        body: "   ",
      })
    );
  });
});
