import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE } from "./emailDeliveryPublicMessages";
import { sendResendEmailHttp } from "./resendHttpSend.server";

describe("sendResendEmailHttp", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("throws a safe public message when Resend returns an error JSON body (no secret / API detail in the thrown message)", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "API key is invalid", name: "validation_error" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });

    await assert.rejects(
      async () =>
        sendResendEmailHttp(
          {
            apiKey: "re_test_secret_value",
            from: "from@verified.example",
            to: ["to@patient.example"],
            subject: "Subject",
            text: "Body",
          },
          { tenant_id: "00000000-0000-4000-8000-000000000001", delivery_path: "unit_test" }
        ),
      (err: unknown) => {
        if (!(err instanceof Error)) return false;
        assert.equal(err.message, FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE);
        assert.ok(!err.message.toLowerCase().includes("api key"));
        assert.ok(!err.message.includes("re_test"));
        return true;
      }
    );
  });

  it("returns resend id on HTTP 200", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: "re_abc123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const r = await sendResendEmailHttp(
      { apiKey: "k", from: "from@verified.example", to: ["to@x.example"], subject: "s", text: "t" },
      { delivery_path: "unit_test" }
    );
    assert.equal(r.resendId, "re_abc123");
  });
});

describe("email env expectations (Resend transactional)", () => {
  it("documents stable public send-failed copy for UI and CRM routes", () => {
    assert.ok(FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE.length > 20);
    assert.ok(!FI_RESEND_PUBLIC_SEND_FAILED_MESSAGE.includes("RESEND"));
  });
});
