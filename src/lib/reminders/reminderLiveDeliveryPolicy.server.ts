import "server-only";

/**
 * When `FI_REMINDERS_LIVE_DELIVERY` is `false` / `0` / `off`, the reminder processor skips Resend/Twilio
 * and marks due jobs as **cancelled** with an explanatory `error_log` (staging / UAT safety).
 * When unset or `true`, behaviour matches historical defaults (send when provider keys are configured).
 */
export function isReminderLiveDeliveryEnabled(): boolean {
  const v = process.env.FI_REMINDERS_LIVE_DELIVERY?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  if (v === "true" || v === "1" || v === "on") return true;
  return true;
}

/** Optional override recipient for explicit test sends (never the patient). */
export function reminderTestEmailOverride(): string | null {
  const e = process.env.FI_REMINDER_TEST_EMAIL?.trim();
  return e || null;
}

/** Must be `true` to allow {@link sendTestReminderEmailOverrideAction} to hit Resend. */
export function isReminderTestSendOverrideEnabled(): boolean {
  return process.env.FI_REMINDERS_TEST_SEND === "true";
}
