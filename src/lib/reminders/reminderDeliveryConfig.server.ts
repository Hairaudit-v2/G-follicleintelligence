import "server-only";

import type { ReminderDeliveryConfig } from "./reminderDeliveryConfig";

/** Reads Resend/Twilio env vars for reminder delivery (no secrets logged). */
export function loadReminderDeliveryConfig(): ReminderDeliveryConfig {
  const twilioFrom =
    process.env.TWILIO_FROM_NUMBER?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim() || null;
  return {
    resend: {
      apiKey: process.env.RESEND_API_KEY?.trim() || null,
      fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
      fromName: process.env.RESEND_FROM_NAME?.trim() || null,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() || null,
      authToken: process.env.TWILIO_AUTH_TOKEN?.trim() || null,
      fromNumber: twilioFrom,
      defaultCountryCode: process.env.TWILIO_DEFAULT_COUNTRY_CODE?.trim() || null,
    },
  };
}
