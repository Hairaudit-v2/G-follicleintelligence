import { z } from "zod";
import { PATIENT_ADMIN_NOTE_MAX_LENGTH } from "./patientPolicy";

export const patientAdminPatchBodySchema = z
  .object({
    adminKey: z.string().optional(),
    patient_status: z.enum(["active", "inactive", "archived", "deceased", "duplicate"]).optional(),
    admin_note: z.string().max(PATIENT_ADMIN_NOTE_MAX_LENGTH).nullable().optional(),
  })
  .refine((b) => b.patient_status !== undefined || b.admin_note !== undefined, {
    message: "Provide patient_status and/or admin_note.",
  });

export type PatientAdminPatchBody = z.infer<typeof patientAdminPatchBodySchema>;
