import { z } from "zod";

const severitySchema = z.enum(["info", "attention", "critical"]);
const statusSchema = z.enum(["open", "acknowledged", "resolved", "dismissed"]);

export const recordClinicalIntelligenceEventInputSchema = z.object({
  tenantId: z.string().uuid(),
  patientId: z.string().uuid().nullable().optional(),
  caseId: z.string().uuid().nullable().optional(),
  consultationId: z.string().uuid().nullable().optional(),
  bookingId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  signalKey: z.string().min(1),
  eventType: z.string().min(1).default("clinical_signal"),
  severity: severitySchema.default("info"),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sourceTable: z.string().nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  status: statusSchema.default("open"),
  occurredAt: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type RecordClinicalIntelligenceEventInput = z.infer<
  typeof recordClinicalIntelligenceEventInputSchema
>;
