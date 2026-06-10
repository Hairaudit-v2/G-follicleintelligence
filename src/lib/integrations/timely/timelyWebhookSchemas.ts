import { z } from "zod";

/** Timely → FI patient webhook (Zapier). */
export const timelyPatientWebhookSchema = z
  .object({
    external_id: z.string().min(1, "external_id is required."),
    first_name: z.string().max(200).optional(),
    last_name: z.string().max(200).optional(),
    email: z.string().max(320).optional(),
    mobile: z.string().max(40).optional(),
    date_of_birth: z.string().max(32).optional(),
    notes: z.string().max(8000).optional(),
  })
  .strict();

/** Timely → FI appointment webhook (Zapier). */
export const timelyAppointmentWebhookSchema = z
  .object({
    external_appointment_id: z.string().min(1, "external_appointment_id is required."),
    external_patient_id: z.string().min(1, "external_patient_id is required."),
    service_name: z.string().max(500).optional(),
    staff_name: z.string().max(300).optional(),
    start_time: z.string().min(1, "start_time is required."),
    end_time: z.string().min(1, "end_time is required."),
    notes: z.string().max(8000).optional(),
    status: z.string().max(120).optional(),
  })
  .strict();
