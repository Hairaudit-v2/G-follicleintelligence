import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deriveOutcomeConfidenceLevel } from "@/src/lib/fi-os/outcomeIntelligenceSignals";
import {
  recordOutcomeMeasurementInputSchema,
  recordOutcomeProtocolInputSchema,
  type RecordOutcomeMeasurementInput,
  type RecordOutcomeProtocolInput,
} from "@/src/lib/fi-os/outcomeIntelligenceEventsSchema";

export {
  recordOutcomeMeasurementInputSchema,
  recordOutcomeProtocolInputSchema,
  computeTenantOutcomeAggregateDraftInputSchema,
  computeGlobalOutcomeAggregateDraftInputSchema,
  type RecordOutcomeMeasurementInput,
  type RecordOutcomeProtocolInput,
  type ComputeTenantOutcomeAggregateDraftInput,
  type ComputeGlobalOutcomeAggregateDraftInput,
} from "@/src/lib/fi-os/outcomeIntelligenceEventsSchema";

function isMissingTableError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("does not exist") || m.includes("42p01") || m.includes("not find");
}

export async function recordOutcomeMeasurement(raw: RecordOutcomeMeasurementInput): Promise<{ id: string }> {
  const input = recordOutcomeMeasurementInputSchema.parse(raw);
  const conf =
    input.confidenceLevel ??
    deriveOutcomeConfidenceLevel({
      sourceTable: input.sourceTable ?? null,
      sourceId: input.sourceId ?? null,
      metricValues: input.metricValues,
    });

  const supabase = supabaseAdmin();
  const row = {
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    case_id: input.caseId ?? null,
    checkpoint_key: input.checkpointKey.trim(),
    measurement_date: input.measurementDate?.trim() || null,
    metric_values: input.metricValues,
    imaging_refs: input.imagingRefs,
    audit_refs: input.auditRefs,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    confidence_level: conf,
    visibility_scope: input.visibilityScope ?? "tenant_clinical",
    metadata: input.metadata,
  };

  const { data, error } = await supabase.from("fi_patient_outcome_measurements").insert(row).select("id").single();
  if (error) {
    if (isMissingTableError(error.message ?? "")) {
      throw new Error("Outcome measurements table is not available (migration not applied).");
    }
    throw new Error(error.message);
  }
  return { id: String((data as { id: string }).id) };
}

export async function recordOutcomeProtocol(raw: RecordOutcomeProtocolInput): Promise<{ id: string }> {
  const input = recordOutcomeProtocolInputSchema.parse(raw);
  const supabase = supabaseAdmin();
  const row = {
    tenant_id: input.tenantId,
    case_id: input.caseId ?? null,
    patient_id: input.patientId ?? null,
    protocol_type: input.protocolType.trim(),
    protocol_key: input.protocolKey.trim(),
    protocol_label: input.protocolLabel.trim(),
    protocol_details: input.protocolDetails,
    started_at: input.startedAt?.trim() || null,
    completed_at: input.completedAt?.trim() || null,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    metadata: input.metadata,
  };

  const { data, error } = await supabase.from("fi_outcome_protocols").insert(row).select("id").single();
  if (error) {
    if (isMissingTableError(error.message ?? "")) {
      throw new Error("Outcome protocols table is not available (migration not applied).");
    }
    throw new Error(error.message);
  }
  return { id: String((data as { id: string }).id) };
}

export {
  computeGlobalOutcomeAggregateDraft,
  computeTenantOutcomeAggregateDraft,
} from "@/src/lib/fi-os/outcomeIntelligenceDrafts";
