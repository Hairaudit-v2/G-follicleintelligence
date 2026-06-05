import { z } from "zod";
import { PATIENT_PREFERRED_CONTACT, REMINDER_TEMPLATE_TYPES, REMINDER_TRIGGER_EVENTS } from "./reminderConstants";

export const reminderTemplateCreateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    name: z.string().min(1).max(200),
    type: z.enum(REMINDER_TEMPLATE_TYPES),
    trigger_event: z.enum(REMINDER_TRIGGER_EVENTS),
    subject: z.string().max(500).nullable().optional(),
    body: z.string().min(1).max(16000),
    is_active: z.boolean().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.type === "email") {
      const s = val.subject?.trim() ?? "";
      if (!s) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "subject is required for email templates." });
      }
    }
  });

export const reminderTemplateUpdateBodySchema = z
  .object({
    adminKey: z.string().optional(),
    name: z.string().min(1).max(200).optional(),
    type: z.enum(REMINDER_TEMPLATE_TYPES).optional(),
    trigger_event: z.enum(REMINDER_TRIGGER_EVENTS).optional(),
    subject: z.string().max(500).nullable().optional(),
    body: z.string().min(1).max(16000).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export const reminderTemplatePreviewBodySchema = z
  .object({
    body: z.string().max(16000),
    subject: z.string().max(500).nullable().optional(),
  })
  .strict();

export type ReminderTemplateCreateBody = z.infer<typeof reminderTemplateCreateBodySchema>;
export type ReminderTemplateUpdateBody = z.infer<typeof reminderTemplateUpdateBodySchema>;

export const patientReminderPrefsPatchSchema = z
  .object({
    adminKey: z.string().optional(),
    reminder_consent: z.boolean().optional(),
    preferred_contact_method: z.enum(PATIENT_PREFERRED_CONTACT).nullable().optional(),
  })
  .strict()
  .refine((b) => b.reminder_consent !== undefined || b.preferred_contact_method !== undefined, {
    message: "Provide reminder_consent and/or preferred_contact_method.",
  });

export const placeholderSampleContextSchema = z.object({
  patient_name: z.string().optional(),
  booking_time: z.string().optional(),
  clinic_name: z.string().optional(),
  booking_title: z.string().optional(),
  booking_type: z.string().optional(),
});

export type PlaceholderSampleContext = z.infer<typeof placeholderSampleContextSchema>;
