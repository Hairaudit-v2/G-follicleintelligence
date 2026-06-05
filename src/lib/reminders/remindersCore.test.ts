import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bookingStartsAfterNow,
  renderReminderText,
  scheduledAtForBookingTrigger,
  scheduledAtForImmediateTrigger,
  templateTypeMatchesPreference,
  toBookingScheduleTrigger,
  formatNextReminderHint,
} from "./remindersCore";

describe("remindersCore — bookingStartsAfterNow", () => {
  it("detects future start", () => {
    assert.equal(bookingStartsAfterNow("2030-01-01T00:00:00.000Z", Date.parse("2026-01-01T00:00:00.000Z")), true);
    assert.equal(bookingStartsAfterNow("2020-01-01T00:00:00.000Z", Date.parse("2026-01-01T00:00:00.000Z")), false);
  });
});

describe("remindersCore — template rendering", () => {
  it("replaces known placeholders", () => {
    const out = renderReminderText("Hi {{patient_name}}, see you at {{booking_time}} at {{clinic_name}}.", {
      patient_name: "Alex",
      booking_time: "Mon, Jun 1, 10:00 AM",
      clinic_name: "Evolved Hair",
    });
    assert.equal(out, "Hi Alex, see you at Mon, Jun 1, 10:00 AM at Evolved Hair.");
  });

  it("leaves unknown tokens", () => {
    const out = renderReminderText("{{patient_name}} / {{unknown}}", { patient_name: "Pat" });
    assert.equal(out, "Pat / {{unknown}}");
  });

  it("renders norwood_summary token", () => {
    const out = renderReminderText("Clinical: {{norwood_summary}}", {
      norwood_summary: "Norwood IV · Ludwig I",
    });
    assert.equal(out, "Clinical: Norwood IV · Ludwig I");
  });
});

describe("remindersCore — scheduling helpers", () => {
  it("booking_created uses nowIso", () => {
    const now = "2026-06-01T12:00:00.000Z";
    const t = scheduledAtForBookingTrigger({
      trigger: "booking_created",
      bookingStartIso: "2026-06-10T10:00:00.000Z",
      nowIso: now,
    });
    assert.equal(t, now);
  });

  it("booking_24h_before clamps to now when late", () => {
    const now = "2026-06-09T12:00:00.000Z";
    const t = scheduledAtForBookingTrigger({
      trigger: "booking_24h_before",
      bookingStartIso: "2026-06-10T10:00:00.000Z",
      nowIso: now,
    });
    assert.equal(t, now);
  });

  it("toBookingScheduleTrigger maps shorthand offsets", () => {
    assert.equal(toBookingScheduleTrigger("booking_48h"), "booking_48h_before");
    assert.equal(toBookingScheduleTrigger("booking_24h"), "booking_24h_before");
    assert.equal(toBookingScheduleTrigger("post_consult"), null);
  });

  it("scheduledAtForImmediateTrigger covers lead and post-consult", () => {
    const now = "2026-06-01T08:00:00.000Z";
    assert.equal(scheduledAtForImmediateTrigger("lead_created", now), now);
    assert.equal(scheduledAtForImmediateTrigger("post_consult", now), now);
    assert.equal(scheduledAtForImmediateTrigger("booking_created", now), null);
  });

  it("formatNextReminderHint picks earliest pending job", () => {
    const hint = formatNextReminderHint([
      {
        scheduled_at: "2026-06-10T10:00:00.000Z",
        status: "sent",
        template_name: "Old",
        template_type: "email",
      },
      {
        scheduled_at: "2026-06-09T08:00:00.000Z",
        status: "pending",
        template_name: "Sooner",
        template_type: "sms",
      },
      {
        scheduled_at: "2026-06-08T08:00:00.000Z",
        status: "pending",
        template_name: "Earlier",
        template_type: "email",
      },
    ]);
    assert.ok(hint?.includes("Earlier"));
    assert.ok(hint?.includes("email"));
  });

  it("templateTypeMatchesPreference respects patient preference", () => {
    assert.equal(templateTypeMatchesPreference("email", "sms"), false);
    assert.equal(templateTypeMatchesPreference("sms", "email"), false);
    assert.equal(templateTypeMatchesPreference("email", "both"), true);
    assert.equal(templateTypeMatchesPreference("sms", null), true);
  });
});
