import { z } from "zod";

export const prescriptionItemDraftSchema = z.object({
  catalogueId: z.string().uuid(),
  doseInstructions: z.string().max(8000).default(""),
  repeatsInstructions: z.string().max(4000).optional().nullable(),
  reorderRule: z.string().max(4000).optional().nullable(),
  /** Required true when repeats/reorder text is present (DoctorOS 1B repeat governance). */
  repeatRulesPrescriberConfirmed: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const savePrescriptionDraftBodySchema = z.object({
  tenantId: z.string().min(1),
  prescriptionId: z.string().uuid().optional().nullable(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  caseId: z.string().uuid().optional().nullable(),
  clinicalNotes: z.string().max(16000).optional().nullable(),
  deliveryType: z.string().max(200).optional().nullable(),
  patientShippingAddress: z.string().max(8000).optional().nullable(),
  pharmacyName: z.string().max(500).optional().nullable(),
  repeatsAllowed: z.boolean().optional().default(false),
  repeatLimit: z.number().int().min(0).max(99).optional().default(0),
  reorderValidFrom: z.string().max(80).optional().nullable(),
  reorderValidUntil: z.string().max(80).optional().nullable(),
  reorderReviewRequired: z.boolean().optional().default(false),
  patientReorderFeePence: z.number().int().min(0).max(1_000_000).optional().nullable(),
  reorderFeePaymentRequired: z.boolean().optional().default(false),
  items: z.array(prescriptionItemDraftSchema).default([]),
});

export const prescriptionIdBodySchema = z.object({
  tenantId: z.string().min(1),
  prescriptionId: z.string().uuid(),
});
