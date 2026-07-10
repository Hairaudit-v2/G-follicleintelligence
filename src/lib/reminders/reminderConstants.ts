/** Allowed `fi_reminder_templates.trigger_event` values (app + DB check). */
export const REMINDER_TRIGGER_EVENTS = [
  "booking_created",
  "booking_48h_before",
  "booking_24h_before",
  /** Shorthand aliases (same schedule as `*_before`). */
  "booking_48h",
  "booking_24h",
  "booking_same_day",
  "booking_cancelled",
  "booking_rescheduled",
  "post_consult",
  "lead_created",
  "invoice_deposit_reminder",
  "invoice_balance_reminder",
  "invoice_due_reminder",
  "invoice_overdue_reminder",
  "invoice_paid_receipt",
] as const;

export type ReminderTriggerEvent = (typeof REMINDER_TRIGGER_EVENTS)[number];

export const REMINDER_TEMPLATE_TYPES = ["sms", "email"] as const;
export type ReminderTemplateType = (typeof REMINDER_TEMPLATE_TYPES)[number];

export const REMINDER_JOB_STATUSES = [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
] as const;
export type ReminderJobStatus = (typeof REMINDER_JOB_STATUSES)[number];

export const PATIENT_PREFERRED_CONTACT = ["email", "sms", "both"] as const;
export type PatientPreferredContactMethod = (typeof PATIENT_PREFERRED_CONTACT)[number];

/** Human labels for template hub UI. */
export const REMINDER_TRIGGER_LABELS: Record<ReminderTriggerEvent, string> = {
  booking_created: "Booking confirmation",
  booking_48h_before: "Booking — 48 hours before",
  booking_24h_before: "Booking — 24 hours before",
  booking_48h: "Booking — 48h (alias)",
  booking_24h: "Booking — 24h (alias)",
  booking_same_day: "Booking — same day",
  booking_cancelled: "Booking cancelled",
  booking_rescheduled: "Booking rescheduled",
  post_consult: "Post-consultation",
  lead_created: "New lead / enquiry",
  invoice_deposit_reminder: "Invoice — deposit reminder",
  invoice_balance_reminder: "Invoice — balance reminder",
  invoice_due_reminder: "Invoice — due soon",
  invoice_overdue_reminder: "Invoice — overdue",
  invoice_paid_receipt: "Invoice — payment receipt",
};

export const REMINDER_TRIGGER_GROUPS: Array<{
  id: string;
  label: string;
  triggers: readonly ReminderTriggerEvent[];
}> = [
  {
    id: "booking",
    label: "Booking messages",
    triggers: [
      "booking_created",
      "booking_same_day",
      "booking_24h_before",
      "booking_48h_before",
      "booking_24h",
      "booking_48h",
      "booking_rescheduled",
      "booking_cancelled",
    ],
  },
  {
    id: "journey",
    label: "Lead & consult journey",
    triggers: ["lead_created", "post_consult"],
  },
  {
    id: "invoice",
    label: "Invoice & payment reminders",
    triggers: [
      "invoice_deposit_reminder",
      "invoice_balance_reminder",
      "invoice_due_reminder",
      "invoice_overdue_reminder",
      "invoice_paid_receipt",
    ],
  },
];
