import { z } from "zod";

export const pharmacySendBodySchema = z.object({
  tenantId: z.string().min(1),
  prescriptionId: z.string().uuid(),
  pharmacyId: z.string().uuid(),
  method: z.enum(["email", "api", "manual_export"]),
});

export const transmissionIdBodySchema = z.object({
  tenantId: z.string().min(1),
  transmissionId: z.string().uuid(),
});
