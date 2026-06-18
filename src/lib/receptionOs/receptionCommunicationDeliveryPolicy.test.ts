import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  isReceptionOsCommunicationDryRun,
  isReceptionOsEmailSendEnabled,
  isReceptionOsSmsSendEnabled,
  shouldReceptionOsLiveSend,
} from "@/src/lib/receptionOs/receptionCommunicationDeliveryPolicy";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("receptionCommunicationDeliveryPolicy", () => {
  it("defaults to dry-run when flags are unset", () => {
    delete process.env.RECEPTION_OS_COMMUNICATION_DRY_RUN;
    delete process.env.RECEPTION_OS_EMAIL_SEND_ENABLED;
    delete process.env.RECEPTION_OS_SMS_SEND_ENABLED;
    assert.equal(isReceptionOsCommunicationDryRun(), true);
    assert.equal(isReceptionOsEmailSendEnabled(), false);
    assert.equal(isReceptionOsSmsSendEnabled(), false);
    assert.equal(shouldReceptionOsLiveSend("email"), false);
    assert.equal(shouldReceptionOsLiveSend("sms"), false);
  });

  it("allows live email only when dry-run is off and email flag enabled", () => {
    process.env.RECEPTION_OS_COMMUNICATION_DRY_RUN = "false";
    process.env.RECEPTION_OS_EMAIL_SEND_ENABLED = "true";
    process.env.RECEPTION_OS_SMS_SEND_ENABLED = "false";
    assert.equal(isReceptionOsCommunicationDryRun(), false);
    assert.equal(shouldReceptionOsLiveSend("email"), true);
    assert.equal(shouldReceptionOsLiveSend("sms"), false);
  });

  it("allows live sms only when dry-run is off and sms flag enabled", () => {
    process.env.RECEPTION_OS_COMMUNICATION_DRY_RUN = "off";
    process.env.RECEPTION_OS_EMAIL_SEND_ENABLED = "false";
    process.env.RECEPTION_OS_SMS_SEND_ENABLED = "on";
    assert.equal(shouldReceptionOsLiveSend("email"), false);
    assert.equal(shouldReceptionOsLiveSend("sms"), true);
  });

  it("honours explicit dry-run true even when channel flags are enabled", () => {
    process.env.RECEPTION_OS_COMMUNICATION_DRY_RUN = "true";
    process.env.RECEPTION_OS_EMAIL_SEND_ENABLED = "true";
    process.env.RECEPTION_OS_SMS_SEND_ENABLED = "true";
    assert.equal(shouldReceptionOsLiveSend("email"), false);
    assert.equal(shouldReceptionOsLiveSend("sms"), false);
  });
});
