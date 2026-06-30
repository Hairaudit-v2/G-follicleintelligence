import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  receptionCommunicationActionAllowed,
  receptionCommunicationSendAllowed,
} from "@/src/lib/receptionOs/receptionCommunicationPolicy";

describe("receptionCommunicationPolicy", () => {
  it("allows receptionist to preview and log manual contact", () => {
    assert.equal(receptionCommunicationActionAllowed("receptionist", "preview"), true);
    assert.equal(receptionCommunicationActionAllowed("receptionist", "log_call"), true);
    assert.equal(receptionCommunicationActionAllowed("receptionist", "add_note"), true);
    assert.equal(receptionCommunicationActionAllowed("receptionist", "copy_payment_link"), true);
  });

  it("blocks receptionist from sending templated SMS/email", () => {
    assert.equal(
      receptionCommunicationActionAllowed("receptionist", "send_sms", "deposit_reminder"),
      false
    );
    assert.equal(
      receptionCommunicationActionAllowed("receptionist", "send_email", "quote_follow_up"),
      false
    );
  });

  it("allows consultant quote and consultation follow-ups", () => {
    assert.equal(receptionCommunicationSendAllowed("consultant", "quote_follow_up"), true);
    assert.equal(receptionCommunicationSendAllowed("consultant", "consultation_no_show"), true);
    assert.equal(receptionCommunicationSendAllowed("consultant", "deposit_reminder"), false);
  });

  it("allows clinic manager and admin to send all templates", () => {
    assert.equal(receptionCommunicationSendAllowed("clinic_manager", "deposit_reminder"), true);
    assert.equal(receptionCommunicationSendAllowed("admin", "payment_link_follow_up"), true);
  });
});
