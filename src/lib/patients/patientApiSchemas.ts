import { z } from "zod";
import { PATIENT_PREFERRED_CONTACT } from "@/src/lib/reminders/reminderConstants";
import { PATIENT_ADMIN_NOTE_MAX_LENGTH } from "./patientPolicy";

export const patientAdminPatchBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patient_status: z.enum(["active", "inactive", "archived", "deceased", "duplicate"]).optional(),
    admin_note: z.string().max(PATIENT_ADMIN_NOTE_MAX_LENGTH).nullable().optional(),
    reminder_consent: z.boolean().optional(),
    preferred_contact_method: z.enum(PATIENT_PREFERRED_CONTACT).nullable().optional(),
  })
  .refine(
    (b) =>
      b.patient_status !== undefined ||
      b.admin_note !== undefined ||
      b.reminder_consent !== undefined ||
      b.preferred_contact_method !== undefined,
    {
      message: "Provide at least one field to update.",
    }
  );

export type PatientAdminPatchBody = z.infer<typeof patientAdminPatchBodySchema>;
