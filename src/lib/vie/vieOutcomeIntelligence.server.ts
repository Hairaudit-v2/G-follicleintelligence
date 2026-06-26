import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadViePatientImagingCompleteness } from "./vieCompleteness.server";
import {
  buildOutcomeCompletenessInput,
  buildVieOutcomeSummary,
  mapComparisonPairToOutcomeInput,
} from "./vieOutcomeIntelligenceCore";
import type { VieOutcomeSummary, VieOutcomeSummaryRow } from "./vieOutcomeTypes";
import { loadVieComparisonPairsForPatient, loadVieComparisonReadinessForPatient } from "./vieLongitudinalComparison.server";
import { loadPatientTwinAlignmentSummary } from "./vieSameAngleAlignment.server";

function mapOutcomeRow(row: Record<string, unknown>): VieOutcomeSummaryRow {
  const domains = Array.isArray(row.domains) ? row.domains : [];
  const warnings = Array.isArray(row.warnings) ? row.warnings.map(String) : [];
  const nextActions = Array.isArray(row.next_actions) ? row.next_actions : [];
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    engine_version: "vie-outcome.v1",
    patient_id: String(row.patient_id),
    case_id: row.case_id != null ? String(row.case_id) : null,
    overall_outcome_readiness_score: Number(row.overall_outcome_readiness_score ?? 0),
    confidence_band: String(row.confidence_band ?? "low") as VieOutcomeSummaryRow["confidence_band"],
    domains: domains as VieOutcomeSummaryRow["domains"],
    audit_ready: row.audit_ready === true,
    clinical_review_recommended: row.clinical_review_recommended === true,
    warnings,
    next_actions: nextActions as VieOutcomeSummaryRow["next_actions"],
    generated_at: String(row.generated_at ?? row.created_at),
    metadata,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function assembleOutcomeInputs(
  tenantId: string,
  patientId: string,
  caseId: string | null | undefined,
  client: SupabaseClient
) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const cid = caseId?.trim() || null;

  const [pairs, imagingCompleteness, comparisonReadiness, alignmentSummary] = await Promise.all([
    loadVieComparisonPairsForPatient(tid, pid, { caseId: cid, reviewStatus: "all", client }),
    loadViePatientImagingCompleteness(tid, pid, client),
    loadVieComparisonReadinessForPatient(tid, pid, cid, client),
    loadPatientTwinAlignmentSummary(tid, pid, client),
  ]);

  const completeness = buildOutcomeCompletenessInput({
    consultation_percent: imagingCompleteness.consultation.percent,
    donor_documentation_percent: imagingCompleteness.donor_documentation.percent,
    surgical_documentation_percent: imagingCompleteness.surgical_documentation.percent,
    follow_up_progression_coverage: comparisonReadiness.follow_up_progression_coverage,
  });

  const pairInputs = pairs.map(mapComparisonPairToOutcomeInput);

  return {
    pairInputs,
    completeness,
    alignmentConsistencyScore: alignmentSummary.alignment_consistency_score,
    caseId: cid,
  };
}

export async function generateVieOutcomeSummaryForPatient(params: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  client?: SupabaseClient;
}): Promise<VieOutcomeSummary> {
  const client = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();

  const { pairInputs, completeness, alignmentConsistencyScore, caseId } = await assembleOutcomeInputs(
    tid,
    pid,
    params.caseId,
    client
  );

  const summary = buildVieOutcomeSummary({
    patientId: pid,
    caseId,
    pairs: pairInputs,
    completeness,
    alignmentConsistencyScore,
  });

  const now = summary.generated_at;
  const row = {
    tenant_id: tid,
    patient_id: pid,
    case_id: caseId,
    overall_outcome_readiness_score: summary.overall_outcome_readiness_score,
    confidence_band: summary.confidence_band,
    audit_ready: summary.audit_ready,
    clinical_review_recommended: summary.clinical_review_recommended,
    domains: summary.domains,
    warnings: summary.warnings,
    next_actions: summary.next_actions,
    metadata: {
      engine_version: summary.engine_version,
      alignment_consistency_score: alignmentConsistencyScore,
    },
    generated_at: now,
    updated_at: now,
  };

  const existing = await loadVieOutcomeSummaryForPatient(tid, pid, { caseId, client });
  if (existing) {
    const { error } = await client
      .from("fi_vie_outcome_summaries")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("fi_vie_outcome_summaries").insert({
      ...row,
      created_at: now,
    });
    if (error) throw new Error(error.message);
  }

  return summary;
}

export async function loadVieOutcomeSummaryForPatient(
  tenantId: string,
  patientId: string,
  opts?: { caseId?: string | null; client?: SupabaseClient }
): Promise<VieOutcomeSummaryRow | null> {
  const client = opts?.client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const cid = opts?.caseId?.trim() || null;

  let query = client
    .from("fi_vie_outcome_summaries")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (cid) {
    query = query.eq("case_id", cid);
  } else {
    query = query.is("case_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapOutcomeRow(data as Record<string, unknown>);
}

/** Compute outcome summary without requiring persisted row (Patient Twin live projection). */
export async function computeVieOutcomeSummaryForPatient(
  tenantId: string,
  patientId: string,
  opts?: { caseId?: string | null; client?: SupabaseClient }
): Promise<VieOutcomeSummary> {
  const client = opts?.client ?? supabaseAdmin();
  const { pairInputs, completeness, alignmentConsistencyScore, caseId } = await assembleOutcomeInputs(
    tenantId,
    patientId,
    opts?.caseId,
    client
  );

  return buildVieOutcomeSummary({
    patientId: patientId.trim(),
    caseId,
    pairs: pairInputs,
    completeness,
    alignmentConsistencyScore,
  });
}

/** Fire-and-forget — never throws; must not block capture accept or comparison flows. */
export async function regenerateVieOutcomeSummaryBestEffort(params: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
}): Promise<void> {
  try {
    await generateVieOutcomeSummaryForPatient(params);
  } catch {
    // best-effort
  }
}
