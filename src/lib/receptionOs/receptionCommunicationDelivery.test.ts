import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapSendResultToDeliveryStatus } from "@/src/lib/receptionOs/receptionCommunicationDeliveryModel";

describe("receptionCommunicationDelivery", () => {
  it("maps dry-run stub results to dry_run status", () => {
    assert.equal(
      mapSendResultToDeliveryStatus({
        sendResult: {
          delivered: false,
          externalMessageId: "dry-run-sms-1",
          provider: "stub",
          detail: "Dry run",
        },
        dryRun: true,
      }),
      "dry_run",
    );
  });

  it("maps successful live send to sent", () => {
    assert.equal(
      mapSendResultToDeliveryStatus({
        sendResult: {
          delivered: true,
          externalMessageId: "re_123",
          provider: "resend",
          detail: "sent",
        },
        dryRun: false,
      }),
      "sent",
    );
  });

  it("maps failed live send to failed", () => {
    assert.equal(
      mapSendResultToDeliveryStatus({
        sendResult: {
          delivered: false,
          externalMessageId: null,
          provider: "twilio",
          detail: "SMS delivery failed",
        },
        dryRun: false,
      }),
      "failed",
    );
  });

  it("maps blocked safety failures to failed", () => {
    assert.equal(
      mapSendResultToDeliveryStatus({
        sendResult: {
          delivered: false,
          externalMessageId: null,
          provider: "stub",
          detail: "blocked",
        },
        dryRun: false,
        blocked: true,
      }),
      "failed",
    );
  });
});
