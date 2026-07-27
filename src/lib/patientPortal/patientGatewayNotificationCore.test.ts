import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
  applyNotificationPreferencesPatch,
  buildPrivacySafeNotificationPreview,
  decideNotificationDispatch,
  isTransactionalNotificationEvent,
  seedPreferencesFromPatientContact,
} from "./patientGatewayNotificationCore";

describe("patientGatewayNotificationCore", () => {
  it("P/Q. patch applies allowed booleans only", () => {
    const next = applyNotificationPreferencesPatch(
      DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
      { email: false, sms: false, push: true, unknown: true, messageNotifications: false }
    );
    assert.equal(next.email, false);
    assert.equal(next.push, true);
    assert.equal(next.messageNotifications, false);
    assert.equal("unknown" in next, false);
  });

  it("S/U. marketing/reminder opt-out does not disable transactional events", () => {
    assert.equal(isTransactionalNotificationEvent("appointment_changed"), true);
    assert.equal(isTransactionalNotificationEvent("payment_received"), true);
    assert.equal(isTransactionalNotificationEvent("new_message"), false);

    const decision = decideNotificationDispatch({
      event: "appointment_changed",
      preferences: {
        ...DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
        email: false,
        sms: false,
        push: false,
        appointmentReminders: false,
      },
    });
    assert.equal(decision.transactional, true);
    assert.ok(decision.channels.includes("email"));
    assert.equal(decision.skippedReason, null);
  });

  it("T. disabled optional category skips non-transactional dispatch", () => {
    const decision = decideNotificationDispatch({
      event: "new_message",
      preferences: {
        ...DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
        messageNotifications: false,
      },
    });
    assert.equal(decision.channels.length, 0);
    assert.equal(decision.skippedReason, "category_opt_out");
  });

  it("V. previews never embed clinical detail placeholders", () => {
    for (const event of [
      "new_message",
      "appointment_changed",
      "invoice_due",
      "images_due",
    ] as const) {
      const preview = buildPrivacySafeNotificationPreview(event);
      assert.ok(!/finasteride|blood|prescription|diagnosis/i.test(preview));
    }
  });

  it("seeds from reminder_consent when gateway prefs unset", () => {
    const seeded = seedPreferencesFromPatientContact({
      reminderConsent: false,
      preferredContactMethod: "sms",
      stored: null,
    });
    assert.equal(seeded.sms, true);
    assert.equal(seeded.appointmentReminders, false);
  });
});
