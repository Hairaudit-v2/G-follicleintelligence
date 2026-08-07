/**
 * FI-DEMO-DAY-2A.4 — Surgical plan + procedure SoR loader for Health record overview.
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";

export type SurgicalStorySoR = {
  caseId: string | null;
  surgeryPlan: {
    planningStatus: string | null;
    plannedProcedureType: string | null;
    surgicalPlanSummary: string | null;
    planningNotes: string | null;
    estimatedGraftsMin: number | null;
    estimatedGraftsMax: number | null;
    hairlineStatus: string | null;
  } | null;
  plannedZones: PlannedZoneRow[] | null;
  surgery: {
    surgeryDate: string | null;
    surgeryStatus: string | null;
    technique: string | null;
    implantedGrafts: number | null;
    extractedGrafts: number | null;
    discardedGrafts: number | null;
    transectionRatePercent: number | null;
  } | null;
};

function asZones(raw: unknown): PlannedZoneRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw as PlannedZoneRow[];
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export async function loadPatientTwinSurgicalStory(input: {
  tenantId: string;
  caseId: string | null;
}): Promise<SurgicalStorySoR> {
  const tid = input.tenantId.trim();
  const caseId = input.caseId?.trim() || null;
  if (!caseId) {
    return { caseId: null, surgeryPlan: null, plannedZones: null, surgery: null };
  }

  const supabase = supabaseAdmin();

  let surgeryPlan: SurgicalStorySoR["surgeryPlan"] = null;
  let plannedZones: PlannedZoneRow[] | null = null;
  let hairlineStatus: string | null = null;

  try {
    const { data: plan, error: planError } = await supabase
      .from("fi_case_surgery_plans")
      .select(
        "planning_status, planned_procedure_type, surgical_plan_summary, planning_notes, planned_zones, estimated_grafts_min, estimated_grafts_max"
      )
      .eq("tenant_id", tid)
      .eq("case_id", caseId)
      .maybeSingle();
    if (planError) throw planError;
    if (plan) {
      const row = plan as Record<string, unknown>;
      plannedZones = asZones(row.planned_zones);
      surgeryPlan = {
        planningStatus: row.planning_status ? String(row.planning_status) : null,
        plannedProcedureType: row.planned_procedure_type
          ? String(row.planned_procedure_type)
          : null,
        surgicalPlanSummary: row.surgical_plan_summary
          ? String(row.surgical_plan_summary)
          : null,
        planningNotes: row.planning_notes ? String(row.planning_notes) : null,
        estimatedGraftsMin: numOrNull(row.estimated_grafts_min),
        estimatedGraftsMax: numOrNull(row.estimated_grafts_max),
        hairlineStatus: null,
      };
    }
  } catch (error) {
    const err = error as { message?: string } | null | undefined;
    if (!isSupabaseMissingRelationError(err)) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  try {
    const { data: design, error: designError } = await supabase
      .from("fi_case_hairline_designs")
      .select("status")
      .eq("tenant_id", tid)
      .eq("case_id", caseId)
      .order("design_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (designError) throw designError;
    if (design) {
      hairlineStatus = String((design as { status?: string }).status ?? "") || null;
    }
  } catch (error) {
    const err = error as { message?: string } | null | undefined;
    if (!isSupabaseMissingRelationError(err)) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  if (surgeryPlan) {
    surgeryPlan = { ...surgeryPlan, hairlineStatus };
  } else if (hairlineStatus) {
    surgeryPlan = {
      planningStatus: null,
      plannedProcedureType: null,
      surgicalPlanSummary: null,
      planningNotes: null,
      estimatedGraftsMin: null,
      estimatedGraftsMax: null,
      hairlineStatus,
    };
  }

  let surgery: SurgicalStorySoR["surgery"] = null;
  try {
    const { data: surgeryRow, error: surgeryError } = await supabase
      .from("fi_surgeries")
      .select("id, status, scheduled_start_at, actual_start_at, metadata")
      .eq("tenant_id", tid)
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (surgeryError) throw surgeryError;

    if (surgeryRow) {
      const s = surgeryRow as {
        id?: string;
        status?: string | null;
        scheduled_start_at?: string | null;
        actual_start_at?: string | null;
        metadata?: Record<string, unknown> | null;
      };
      const meta =
        s.metadata && typeof s.metadata === "object" && !Array.isArray(s.metadata)
          ? s.metadata
          : {};
      const technique =
        typeof meta.technique === "string"
          ? meta.technique
          : typeof meta.extraction_technique === "string"
            ? meta.extraction_technique
            : null;
      const transectionRatePercent = numOrNull(meta.transection_rate_percent);

      let implantedGrafts: number | null = null;
      let extractedGrafts: number | null = null;
      let discardedGrafts: number | null = null;
      const surgeryId = String(s.id ?? "").trim();
      if (surgeryId) {
        const { data: graft, error: graftError } = await supabase
          .from("fi_surgery_graft_sessions")
          .select("implanted_grafts, extracted_grafts, discarded_grafts, target_grafts")
          .eq("tenant_id", tid)
          .eq("surgery_id", surgeryId)
          .maybeSingle();
        if (graftError && !isSupabaseMissingRelationError(graftError)) {
          throw new Error(graftError.message);
        }
        if (graft) {
          const g = graft as Record<string, unknown>;
          implantedGrafts = numOrNull(g.implanted_grafts);
          extractedGrafts = numOrNull(g.extracted_grafts);
          discardedGrafts = numOrNull(g.discarded_grafts);
        }
      }

      surgery = {
        surgeryDate: s.actual_start_at ?? s.scheduled_start_at ?? null,
        surgeryStatus: s.status ?? null,
        technique,
        implantedGrafts,
        extractedGrafts,
        discardedGrafts,
        transectionRatePercent,
      };
    }
  } catch (error) {
    const err = error as { message?: string } | null | undefined;
    if (!isSupabaseMissingRelationError(err)) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  return { caseId, surgeryPlan, plannedZones, surgery };
}
