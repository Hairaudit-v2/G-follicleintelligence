import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import type {
  OutcomeMeasurementRow,
  OutcomeProtocolRow,
} from "@/src/lib/fi-os/outcomeIntelligenceCaseView";

export type {
  CaseOutcomeIntelligenceView,
  OutcomeMeasurementRow,
  OutcomeProtocolRow,
} from "@/src/lib/fi-os/outcomeIntelligenceCaseView";
export { buildCaseOutcomeIntelligenceView } from "@/src/lib/fi-os/outcomeIntelligenceCaseView";

export type TenantOutcomeAggregateRow = {
  id: string;
  cohort_key: string;
  cohort_description: string | null;
  aggregate_period_start: string;
  aggregate_period_end: string;
  metric_summary: Record<string, unknown>;
  protocol_mix: Record<string, unknown>;
  sample_size: number;
  confidence_level: string;
  visibility_scope: string;
  computed_at: string;
};

export type GlobalOutcomeAggregateRow = {
  id: string;
  cohort_key: string;
  cohort_description: string | null;
  aggregate_period_start: string;
  aggregate_period_end: string;
  metric_summary: Record<string, unknown>;
  protocol_mix: Record<string, unknown>;
  contributing_tenant_count: number;
  sample_size: number;
  confidence_level: string;
  anonymisation_threshold_met: boolean;
  computed_at: string;
};

export type TenantOutcomeIntelligenceSummary = {
  outcomesCapturedApprox: number;
  twelveMonthCheckpointsCaptured: number;
  twelveMonthCheckpointsTotal: number;
  imagingSignalsApprox: number;
  auditScoreSignalsApprox: number;
  globalBenchmarkRowsVisible: number;
  notes: string[];
};

export const EMPTY_TENANT_OUTCOME_INTELLIGENCE_SUMMARY: TenantOutcomeIntelligenceSummary = {
  outcomesCapturedApprox: 0,
  twelveMonthCheckpointsCaptured: 0,
  twelveMonthCheckpointsTotal: 6,
  imagingSignalsApprox: 0,
  auditScoreSignalsApprox: 0,
  globalBenchmarkRowsVisible: 0,
  notes: [],
};

export async function loadCaseOutcomeMeasurements(
  tenantId: string,
  caseId: string
): Promise<OutcomeMeasurementRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_outcome_measurements")
    .select(
      "id, checkpoint_key, measurement_date, metric_values, imaging_refs, audit_refs, case_id"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .order("measurement_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as OutcomeMeasurementRow[];
}

export async function loadPatientOutcomeMeasurements(
  tenantId: string,
  patientId: string
): Promise<OutcomeMeasurementRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_outcome_measurements")
    .select(
      "id, checkpoint_key, measurement_date, metric_values, imaging_refs, audit_refs, case_id"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("measurement_date", { ascending: true, nullsFirst: false })
    .limit(800);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as OutcomeMeasurementRow[];
}

export async function loadPatientOutcomeProtocols(
  tenantId: string,
  patientId: string
): Promise<OutcomeProtocolRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_outcome_protocols")
    .select(
      "id, protocol_type, protocol_key, protocol_label, protocol_details, case_id, patient_id, started_at, completed_at"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as OutcomeProtocolRow[];
}

export async function loadCaseOutcomeProtocols(
  tenantId: string,
  caseId: string
): Promise<OutcomeProtocolRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_outcome_protocols")
    .select(
      "id, protocol_type, protocol_key, protocol_label, protocol_details, case_id, patient_id, started_at, completed_at"
    )
    .eq("tenant_id", tenantId.trim())
    .eq("case_id", caseId.trim())
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as OutcomeProtocolRow[];
}

export async function loadTenantOutcomeAggregateSummary(
  tenantId: string,
  opts?: { limit?: number }
): Promise<TenantOutcomeAggregateRow[]> {
  const supabase = supabaseAdmin();
  const lim = Math.min(Math.max(opts?.limit ?? 12, 1), 50);
  const { data, error } = await supabase
    .from("fi_tenant_outcome_aggregates")
    .select(
      "id, cohort_key, cohort_description, aggregate_period_start, aggregate_period_end, metric_summary, protocol_mix, sample_size, confidence_level, visibility_scope, computed_at"
    )
    .eq("tenant_id", tenantId.trim())
    .order("computed_at", { ascending: false })
    .limit(lim);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as TenantOutcomeAggregateRow[];
}

export async function loadGlobalOutcomeAggregateSummary(opts?: {
  limit?: number;
}): Promise<GlobalOutcomeAggregateRow[]> {
  const supabase = supabaseAdmin();
  const lim = Math.min(Math.max(opts?.limit ?? 12, 1), 50);
  const { data, error } = await supabase
    .from("fi_global_outcome_aggregates")
    .select(
      "id, cohort_key, cohort_description, aggregate_period_start, aggregate_period_end, metric_summary, protocol_mix, contributing_tenant_count, sample_size, confidence_level, anonymisation_threshold_met, computed_at"
    )
    .eq("anonymisation_threshold_met", true)
    .order("computed_at", { ascending: false })
    .limit(lim);
  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as GlobalOutcomeAggregateRow[];
}

const TWELVE_MONTH_CHECKPOINTS = new Set([
  "baseline",
  "day_1",
  "day_7",
  "month_1",
  "month_3",
  "month_6",
  "month_12",
]);

export async function loadTenantOutcomeIntelligenceSummary(
  tenantId: string
): Promise<TenantOutcomeIntelligenceSummary> {
  const tid = tenantId.trim();
  const notes: string[] = [];
  const supabase = supabaseAdmin();

  const [mRes, pRes, gRes] = await Promise.all([
    supabase
      .from("fi_patient_outcome_measurements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid),
    supabase
      .from("fi_patient_outcome_measurements")
      .select("checkpoint_key")
      .eq("tenant_id", tid)
      .limit(2000),
    supabase
      .from("fi_global_outcome_aggregates")
      .select("id", { count: "exact", head: true })
      .eq("anonymisation_threshold_met", true),
  ]);

  if (mRes.error && !isSupabaseMissingRelationError(mRes.error))
    notes.push(`measurements_count:${mRes.error.message}`);
  if (pRes.error && !isSupabaseMissingRelationError(pRes.error))
    notes.push(`measurements_rows:${pRes.error.message}`);
  if (gRes.error && !isSupabaseMissingRelationError(gRes.error))
    notes.push(`global:${gRes.error.message}`);

  const outcomesCapturedApprox = mRes.error ? 0 : (mRes.count ?? 0);
  const ckRows = (pRes.data ?? []) as { checkpoint_key: string }[];
  const capturedSet = new Set(
    ckRows.map((r) => String(r.checkpoint_key ?? "").trim()).filter(Boolean)
  );
  let twelveMonthCheckpointsCaptured = 0;
  for (const k of TWELVE_MONTH_CHECKPOINTS) {
    if (capturedSet.has(k)) twelveMonthCheckpointsCaptured += 1;
  }

  let imagingSignalsApprox = 0;
  let auditScoreSignalsApprox = 0;
  const detailRes = await supabase
    .from("fi_patient_outcome_measurements")
    .select("metric_values")
    .eq("tenant_id", tid)
    .limit(400);
  if (detailRes.error && !isSupabaseMissingRelationError(detailRes.error)) {
    notes.push(`measurements_detail:${detailRes.error.message}`);
  } else if (!detailRes.error) {
    for (const row of (detailRes.data ?? []) as { metric_values: Record<string, unknown> }[]) {
      const mv = row.metric_values ?? {};
      if (mv.imaging_available === true || mv.imaging_available === 1) imagingSignalsApprox += 1;
      if (mv.audit_score_available === true || mv.audit_score_available === 1)
        auditScoreSignalsApprox += 1;
    }
  }

  const globalBenchmarkRowsVisible = gRes.error ? 0 : (gRes.count ?? 0);

  return {
    outcomesCapturedApprox,
    twelveMonthCheckpointsCaptured,
    twelveMonthCheckpointsTotal: TWELVE_MONTH_CHECKPOINTS.size,
    imagingSignalsApprox,
    auditScoreSignalsApprox,
    globalBenchmarkRowsVisible,
    notes,
  };
}
