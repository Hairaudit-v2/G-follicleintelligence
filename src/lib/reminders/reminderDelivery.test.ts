import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildResendFromAddress,
  formatPhoneForTwilio,
  isDeliveryChannelConfigured,
  isEmailDeliveryConfigured,
  isSmsDeliveryConfigured,
  type ReminderDeliveryConfig,
} from "./reminderDeliveryConfig";
import {
  scheduledAtForBookingTrigger,
  scheduledAtForImmediateTrigger,
  toBookingScheduleTrigger,
} from "./remindersCore";
import {
  patientHasContactForTemplateType,
  type PatientReminderContact,
} from "./reminderDeliveryConfig";

const sampleCfg = (overrides?: Partial<ReminderDeliveryConfig>): ReminderDeliveryConfig => ({
  resend: {
    apiKey: "re_test",
    fromEmail: "reminders@example.com",
    fromName: "Clinic",
    ...(overrides?.resend ?? {}),
  },
  twilio: {
    accountSid: "AC_test",
    authToken: "token",
    fromNumber: "+447700900000",
    defaultCountryCode: "44",
    ...(overrides?.twilio ?? {}),
  },
});

describe("reminderDeliveryConfig", () => {
  it("detects configured email and SMS channels", () => {
    const cfg = sampleCfg();
    assert.equal(isEmailDeliveryConfigured(cfg), true);
    assert.equal(isSmsDeliveryConfigured(cfg), true);
    assert.equal(isDeliveryChannelConfigured(cfg, "email"), true);
    assert.equal(isDeliveryChannelConfigured(cfg, "sms"), true);
  });

  it("requires all Resend fields for email", () => {
    const cfg = sampleCfg({ resend: { apiKey: null, fromEmail: "a@b.com", fromName: null } });
    assert.equal(isEmailDeliveryConfigured(cfg), false);
  });

  it("builds Resend from address with optional display name", () => {
    assert.equal(
      buildResendFromAddress({ apiKey: "k", fromEmail: "a@b.com", fromName: "Evolved" }),
      "Evolved <a@b.com>"
    );
    assert.equal(
      buildResendFromAddress({ apiKey: "k", fromEmail: "a@b.com", fromName: null }),
      "a@b.com"
    );
  });
});

describe("formatPhoneForTwilio", () => {
  it("keeps E.164 numbers", () => {
    assert.equal(formatPhoneForTwilio("+447911123456"), "+447911123456");
  });

  it("applies default country code to local numbers", () => {
    assert.equal(formatPhoneForTwilio("07911123456", "44"), "+447911123456");
    assert.equal(formatPhoneForTwilio("7911123456", "44"), "+447911123456");
  });
});

describe("patientHasContactForTemplateType", () => {
  const contact: PatientReminderContact = {
    email: "pat@example.com",
    phone: "07911123456",
    phoneE164: "+447911123456",
  };

  it("matches email and sms requirements", () => {
    assert.equal(patientHasContactForTemplateType(contact, "email"), true);
    assert.equal(patientHasContactForTemplateType(contact, "sms"), true);
    assert.equal(
      patientHasContactForTemplateType({ email: null, phone: null, phoneE164: null }, "email"),
      false
    );
  });
});

describe("booking reminder scheduling — 24h / 48h / post-consult", () => {
  const bookingStart = "2026-06-10T10:00:00.000Z";

  it("schedules 48h before booking start", () => {
    const now = "2026-06-01T12:00:00.000Z";
    const trigger = toBookingScheduleTrigger("booking_48h");
    assert.equal(trigger, "booking_48h_before");
    const scheduled = scheduledAtForBookingTrigger({
      trigger: trigger!,
      bookingStartIso: bookingStart,
      nowIso: now,
    });
    assert.equal(scheduled, "2026-06-08T10:00:00.000Z");
  });

  it("schedules 24h before booking start", () => {
    const now = "2026-06-01T12:00:00.000Z";
    const trigger = toBookingScheduleTrigger("booking_24h_before");
    assert.equal(trigger, "booking_24h_before");
    const scheduled = scheduledAtForBookingTrigger({
      trigger: trigger!,
      bookingStartIso: bookingStart,
      nowIso: now,
    });
    assert.equal(scheduled, "2026-06-09T10:00:00.000Z");
  });

  it("clamps late 48h/24h jobs to now", () => {
    const now = "2026-06-09T12:00:00.000Z";
    const t48 = scheduledAtForBookingTrigger({
      trigger: "booking_48h_before",
      bookingStartIso: bookingStart,
      nowIso: now,
    });
    const t24 = scheduledAtForBookingTrigger({
      trigger: "booking_24h_before",
      bookingStartIso: bookingStart,
      nowIso: now,
    });
    assert.equal(t48, now);
    assert.equal(t24, now);
  });

  it("queues post-consult immediately", () => {
    const now = "2026-06-05T15:30:00.000Z";
    assert.equal(scheduledAtForImmediateTrigger("post_consult", now), now);
  });
});
