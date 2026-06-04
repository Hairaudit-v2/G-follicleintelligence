import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { plannedZoneRowSchema, type PlannedZoneRow } from "./surgeryPlanningTypes";

export type CaseSurgeryPlanRow = {
  id: string;
  tenant_id: string;
  case_id: string;
  planning_status: string;
  planned_procedure_type: string | null;
  planned_session_type: string | null;
  planned_zones: PlannedZoneRow[];
  estimated_grafts_min: number | null;
  estimated_grafts_max: number | null;
  donor_strategy_notes: string | null;
  recipient_strategy_notes: string | null;
  medication_prep_notes: string | null;
  planning_notes: string | null;
  surgical_plan_summary: string | null;
  created_at: string;
  updated_at: string;
};

function parsePlannedZones(raw: unknown): PlannedZoneRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannedZoneRow[] = [];
  for (const item of raw) {
    const p = plannedZoneRowSchema.safeParse(item);
    if (p.success) out.push(p.data);
  }
  return out;
}

/**
 * Loads the surgery plan row for a case, scoped by tenant. Returns null when no plan exists yet.
 */
export async function loadSurgeryPlanForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<CaseSurgeryPlanRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data: row, error } = await supabase
    .from("fi_case_surgery_plans")
    .select(
      "id, tenant_id, case_id, planning_status, planned_procedure_type, planned_session_type, planned_zones, estimated_grafts_min, estimated_grafts_max, donor_strategy_notes, recipient_strategy_notes, medication_prep_notes, planning_notes, surgical_plan_summary, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    case_id: String(r.case_id),
    planning_status: String(r.planning_status ?? "draft"),
    planned_procedure_type: r.planned_procedure_type != null ? String(r.planned_procedure_type) : null,
    planned_session_type: r.planned_session_type != null ? String(r.planned_session_type) : null,
    planned_zones: parsePlannedZones(r.planned_zones),
    estimated_grafts_min: r.estimated_grafts_min != null ? Number(r.estimated_grafts_min) : null,
    estimated_grafts_max: r.estimated_grafts_max != null ? Number(r.estimated_grafts_max) : null,
    donor_strategy_notes: r.donor_strategy_notes != null ? String(r.donor_strategy_notes) : null,
    recipient_strategy_notes: r.recipient_strategy_notes != null ? String(r.recipient_strategy_notes) : null,
    medication_prep_notes: r.medication_prep_notes != null ? String(r.medication_prep_notes) : null,
    planning_notes: r.planning_notes != null ? String(r.planning_notes) : null,
    surgical_plan_summary: r.surgical_plan_summary != null ? String(r.surgical_plan_summary) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}
