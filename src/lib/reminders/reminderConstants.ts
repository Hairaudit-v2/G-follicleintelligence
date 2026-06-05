/** Allowed `fi_reminder_templates.trigger_event` values (app + DB check). */
export const REMINDER_TRIGGER_EVENTS = [
  "booking_created",
  "booking_48h_before",
  "booking_24h_before",
  "lead_created",
] as const;

export type ReminderTriggerEvent = (typeof REMINDER_TRIGGER_EVENTS)[number];

export const REMINDER_TEMPLATE_TYPES = ["sms", "email"] as const;
export type ReminderTemplateType = (typeof REMINDER_TEMPLATE_TYPES)[number];

export const REMINDER_JOB_STATUSES = ["pending", "processing", "sent", "failed"] as const;
export type ReminderJobStatus = (typeof REMINDER_JOB_STATUSES)[number];

export const PATIENT_PREFERRED_CONTACT = ["email", "sms", "both"] as const;
export type PatientPreferredContactMethod = (typeof PATIENT_PREFERRED_CONTACT)[number];
