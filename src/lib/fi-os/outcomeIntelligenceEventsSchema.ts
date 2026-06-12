import { z } from "zod";

const confidenceSchema = z.enum(["unknown", "low", "medium", "high"]);

export const recordOutcomeMeasurementInputSchema = z.object({
  tenantId: z.string().uuid(),
  patientId: z.string().uuid(),
  caseId: z.string().uuid().nullable().optional(),
  checkpointKey: z.string().min(1),
  measurementDate: z.string().nullable().optional(),
  metricValues: z.record(z.unknown()).default({}),
  imagingRefs: z.array(z.unknown()).default([]),
  auditRefs: z.array(z.unknown()).default([]),
  sourceTable: z.string().nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  confidenceLevel: confidenceSchema.optional(),
  visibilityScope: z.enum(["tenant_clinical", "tenant_aggregate", "anonymised_network_candidate"]).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type RecordOutcomeMeasurementInput = z.infer<typeof recordOutcomeMeasurementInputSchema>;

export const recordOutcomeProtocolInputSchema = z.object({
  tenantId: z.string().uuid(),
  caseId: z.string().uuid().nullable().optional(),
  patientId: z.string().uuid().nullable().optional(),
  protocolType: z.string().min(1),
  protocolKey: z.string().min(1),
  protocolLabel: z.string().min(1),
  protocolDetails: z.record(z.unknown()).default({}),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  sourceTable: z.string().nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type RecordOutcomeProtocolInput = z.infer<typeof recordOutcomeProtocolInputSchema>;

export const computeTenantOutcomeAggregateDraftInputSchema = z.object({
  tenantId: z.string().uuid(),
  aggregatePeriodStart: z.string().min(8),
  aggregatePeriodEnd: z.string().min(8),
  cohortKey: z.string().min(1),
  cohortDescription: z.string().nullable().optional(),
  measurements: z
    .array(
      z.object({
        metric_values: z.record(z.unknown()),
      })
    )
    .default([]),
  protocols: z
    .array(
      z.object({
        protocol_key: z.string(),
      })
    )
    .default([]),
  visibilityScope: z.enum(["tenant_only", "anonymised_network_candidate"]).default("tenant_only"),
  metadata: z.record(z.unknown()).default({}),
});

export type ComputeTenantOutcomeAggregateDraftInput = z.infer<typeof computeTenantOutcomeAggregateDraftInputSchema>;

export const computeGlobalOutcomeAggregateDraftInputSchema = z.object({
  cohortKey: z.string().min(1),
  cohortDescription: z.string().nullable().optional(),
  aggregatePeriodStart: z.string().min(8),
  aggregatePeriodEnd: z.string().min(8),
  /** Per-tenant pre-aggregated metric summaries (no identifiers). */
  tenantMetricSummaries: z.array(z.record(z.unknown())).default([]),
  tenantProtocolMixes: z.array(z.record(z.unknown())).default([]),
  contributingTenantCount: z.number().int().nonnegative(),
  sampleSize: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).default({}),
});

export type ComputeGlobalOutcomeAggregateDraftInput = z.infer<typeof computeGlobalOutcomeAggregateDraftInputSchema>;
