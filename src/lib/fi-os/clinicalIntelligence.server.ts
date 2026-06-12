import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TenantActionCentre } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { loadPatientTwinV1 } from "@/src/lib/patientTwin/patientTwinLoader.server";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import { derivePatientTwinIntegritySignals, type PatientClinicalIntelligenceView } from "@/src/lib/fi-os/clinicalIntelligenceSignals";

export type TenantClinicalIntelligenceSummary = {
  readinessAttention: number;
  followUpsOverdue: number;
  pathologyPendingReview: number;
  imagingGapsApprox: number;
  outcomeDataMissingApprox: number;
  /** Non-fatal loader notes (empty in production unless a slice was skipped). */
  notes: string[];
};

export const EMPTY_TENANT_CLINICAL_INTELLIGENCE_SUMMARY: TenantClinicalIntelligenceSummary = {
  readinessAttention: 0,
  followUpsOverdue: 0,
  pathologyPendingReview: 0,
  imagingGapsApprox: 0,
  outcomeDataMissingApprox: 0,
  notes: [],
};

/**
 * Tenant dashboard card counts — bounded queries, tenant-scoped, best-effort when optional tables exist.
 * Reuses operational dashboard action-centre counts when provided to avoid duplicate booking/consult queries.
 */
export async function loadTenantClinicalIntelligenceSummary(
  tenantId: string,
  actionCentre?: Pick<TenantActionCentre, "consultationsAwaitingCompletion" | "followUpsDue" | "surgeryReadinessAlerts">
): Promise<TenantClinicalIntelligenceSummary> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const notes: string[] = [];

  const readinessAttention = actionCentre?.surgeryReadinessAlerts ?? null;
  const followUpsOverdue = actionCentre?.followUpsDue ?? null;

  const [pathRes, activeCasesRes] = await Promise.all([
    supabase
      .from("fi_pathology_results")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "draft"),
    supabase
      .from("fi_cases")
      .select("id")
      .eq("tenant_id", tid)
      .not("status", "eq", "complete")
      .not("status", "eq", "failed")
      .limit(400),
  ]);

  if (pathRes.error && !isSupabaseMissingRelationError(pathRes.error)) {
    notes.push(`pathology_results:${pathRes.error.message}`);
  }

  let pathologyPendingReview = 0;
  if (!pathRes.error) pathologyPendingReview = pathRes.count ?? 0;

  const activeIds = ((activeCasesRes.data ?? []) as { id: string }[]).map((r) => r.id);
  if (activeCasesRes.error) {
    notes.push(`fi_cases:${activeCasesRes.error.message}`);
  }

  let imagingGapsApprox = 0;
  if (activeIds.length) {
    const { data: imgRows, error: imgE } = await supabase
      .from("fi_patient_images")
      .select("case_id")
      .eq("tenant_id", tid)
      .in("case_id", activeIds)
      .not("case_id", "is", null);
    if (imgE) {
      notes.push(`fi_patient_images:${imgE.message}`);
    } else {
      const withImg = new Set(
        (imgRows ?? [])
          .map((r) => String((r as { case_id: string | null }).case_id ?? "").trim())
          .filter(Boolean)
      );
      imagingGapsApprox = activeIds.filter((id) => !withImg.has(id)).length;
    }
  }

  let outcomeDataMissingApprox = 0;
  if (activeIds.length) {
    const { count, error } = await supabase
      .from("fi_case_post_op_tracking")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("post_op_status", "not_started")
      .in("case_id", activeIds.slice(0, 400));
    if (error && !isSupabaseMissingRelationError(error)) {
      notes.push(`fi_case_post_op_tracking:${error.message}`);
    } else if (!error) {
      outcomeDataMissingApprox = count ?? 0;
    }
  }

  return {
    readinessAttention: readinessAttention ?? 0,
    followUpsOverdue: followUpsOverdue ?? 0,
    pathologyPendingReview,
    imagingGapsApprox,
    outcomeDataMissingApprox,
    notes,
  };
}

export type { PatientClinicalIntelligenceView } from "@/src/lib/fi-os/clinicalIntelligenceSignals";

export async function loadPatientClinicalIntelligenceView(params: {
  tenantId: string;
  foundationPatientId: string;
}): Promise<PatientClinicalIntelligenceView | null> {
  const twin = await loadPatientTwinV1({
    tenantId: params.tenantId.trim(),
    foundationPatientId: params.foundationPatientId.trim(),
  });
  if (!twin) return null;
  const signals = derivePatientTwinIntegritySignals(twin);
  const top = signals.sort((a, b) => {
    const rank = { info: 0, attention: 1, critical: 2 };
    return rank[b.severity] - rank[a.severity];
  })[0];
  return {
    signals,
    recommendedNextStep: twin.completeness?.recommended_actions?.[0]?.label ?? top?.title ?? null,
  };
}
