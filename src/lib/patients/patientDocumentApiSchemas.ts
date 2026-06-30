import { z } from "zod";

import { PATIENT_DOCUMENT_TYPES } from "./patientDocumentPolicy";

export const patientConsentUploadNotesSchema = z
  .string()
  .max(2000, "Notes exceed 2000 characters.")
  .optional();

export const patientDocumentListQuerySchema = z.object({
  document_type: z.enum(PATIENT_DOCUMENT_TYPES).optional(),
});