import {
  aggregateOutcomeMetricSummaries,
  mergeOutcomeMetricSummaries,
  mergeProtocolMixMaps,
  parseOutcomeMetricSummary,
  refuseNetworkOutcomeAggregation,
} from "@/src/lib/fi-os/outcomeAggregation";
import {
  computeGlobalOutcomeAggregateDraftInputSchema,
  computeTenantOutcomeAggregateDraftInputSchema,
  type ComputeGlobalOutcomeAggregateDraftInput,
  type ComputeTenantOutcomeAggregateDraftInput,
} from "@/src/lib/fi-os/outcomeIntelligenceEventsSchema";

export function computeTenantOutcomeAggregateDraft(
  raw: ComputeTenantOutcomeAggregateDraftInput
): Record<string, unknown> {
  const input = computeTenantOutcomeAggregateDraftInputSchema.parse(raw);
  const metric_summary = aggregateOutcomeMetricSummaries(input.measurements);
  const protocol_mix: Record<string, number> = {};
  for (const p of input.protocols) {
    const k = String(p.protocol_key ?? "").trim();
    if (!k) continue;
    protocol_mix[k] = (protocol_mix[k] ?? 0) + 1;
  }
  const sample_size = input.measurements.length;
  return {
    tenant_id: input.tenantId,
    aggregate_period_start: input.aggregatePeriodStart,
    aggregate_period_end: input.aggregatePeriodEnd,
    cohort_key: input.cohortKey.trim(),
    cohort_description: input.cohortDescription ?? null,
    metric_summary,
    protocol_mix,
    sample_size,
    confidence_level: sample_size >= 30 ? "medium" : sample_size >= 10 ? "low" : "unknown",
    visibility_scope: input.visibilityScope,
    computed_by: "system",
    metadata: input.metadata,
  };
}

/** Merges per-tenant summaries into a draft global row (no persistence). */
export function computeGlobalOutcomeAggregateDraft(
  raw: ComputeGlobalOutcomeAggregateDraftInput
): Record<string, unknown> {
  const input = computeGlobalOutcomeAggregateDraftInputSchema.parse(raw);
  const parsedSummaries = input.tenantMetricSummaries.map((s) => parseOutcomeMetricSummary(s));
  const metric_summary = mergeOutcomeMetricSummaries(parsedSummaries);
  const protocol_mix = mergeProtocolMixMaps(input.tenantProtocolMixes);
  const gate = refuseNetworkOutcomeAggregation({
    sampleSize: input.sampleSize,
    contributingTenantCount: input.contributingTenantCount,
    metricSummary: metric_summary,
    protocolMix: protocol_mix,
  });
  const anonymisation_threshold_met = gate.ok;
  return {
    cohort_key: input.cohortKey.trim(),
    cohort_description: input.cohortDescription ?? null,
    aggregate_period_start: input.aggregatePeriodStart,
    aggregate_period_end: input.aggregatePeriodEnd,
    metric_summary,
    protocol_mix,
    contributing_tenant_count: input.contributingTenantCount,
    sample_size: input.sampleSize,
    confidence_level: input.sampleSize >= 100 ? "medium" : "low",
    anonymisation_threshold_met,
    computed_by: "system",
    metadata: {
      ...input.metadata,
      gate: gate.ok ? { ok: true } : { ok: false, reasons: gate.reasons },
    },
  };
}
