import { z } from "zod";

export const prescriptionItemDraftSchema = z.object({
  catalogueId: z.string().uuid(),
  doseInstructions: z.string().max(8000).default(""),
  repeatsInstructions: z.string().max(4000).optional().nullable(),
  reorderRule: z.string().max(4000).optional().nullable(),
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
  items: z.array(prescriptionItemDraftSchema).default([]),
});

export const prescriptionIdBodySchema = z.object({
  tenantId: z.string().min(1),
  prescriptionId: z.string().uuid(),
});
