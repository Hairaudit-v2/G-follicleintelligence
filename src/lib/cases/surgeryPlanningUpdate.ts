import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { SurgeryPlanningUpsertPatch } from "./surgeryPlanningTypes";

export type UpsertSurgeryPlanParams = {
  tenantId: string;
  caseId: string;
  patch: SurgeryPlanningUpsertPatch;
};

/**
 * Creates or updates `fi_case_surgery_plans` for a case. Verifies `fi_cases` belongs to the tenant.
 * Service-role Supabase only (call from server actions / routes).
 */
export async function upsertSurgeryPlanForCase(
  params: UpsertSurgeryPlanParams,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(params.caseId, "caseId");
  const p = params.patch;

  const { data: c, error: ce } = await supabase
    .from("fi_cases")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .is("deleted_at", null)
    .maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!c) throw new Error("Case not found for tenant.");

  const { data: existing, error: le } = await supabase
    .from("fi_case_surgery_plans")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .maybeSingle();
  if (le) throw new Error(le.message);

  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (p.planning_status !== undefined) updatePayload.planning_status = p.planning_status;
  if (p.planned_procedure_type !== undefined) {
    updatePayload.planned_procedure_type = p.planned_procedure_type?.trim()
      ? p.planned_procedure_type.trim()
      : null;
  }
  if (p.planned_session_type !== undefined) {
    updatePayload.planned_session_type = p.planned_session_type?.trim()
      ? p.planned_session_type.trim()
      : null;
  }
  if (p.planned_zones !== undefined) updatePayload.planned_zones = p.planned_zones;
  if (p.estimated_grafts_min !== undefined)
    updatePayload.estimated_grafts_min = p.estimated_grafts_min;
  if (p.estimated_grafts_max !== undefined)
    updatePayload.estimated_grafts_max = p.estimated_grafts_max;
  if (p.donor_strategy_notes !== undefined) {
    updatePayload.donor_strategy_notes = p.donor_strategy_notes?.trim()
      ? p.donor_strategy_notes.trim()
      : null;
  }
  if (p.recipient_strategy_notes !== undefined) {
    updatePayload.recipient_strategy_notes = p.recipient_strategy_notes?.trim()
      ? p.recipient_strategy_notes.trim()
      : null;
  }
  if (p.medication_prep_notes !== undefined) {
    updatePayload.medication_prep_notes = p.medication_prep_notes?.trim()
      ? p.medication_prep_notes.trim()
      : null;
  }
  if (p.planning_notes !== undefined) {
    updatePayload.planning_notes = p.planning_notes?.trim() ? p.planning_notes.trim() : null;
  }
  if (p.surgical_plan_summary !== undefined) {
    updatePayload.surgical_plan_summary = p.surgical_plan_summary?.trim()
      ? p.surgical_plan_summary.trim()
      : null;
  }

  if (existing?.id) {
    const { error: ue } = await supabase
      .from("fi_case_surgery_plans")
      .update(updatePayload)
      .eq("tenant_id", tid)
      .eq("case_id", cid);
    if (ue) throw new Error(ue.message);
    return;
  }

  const trimOrNull = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

  const insertPayload = {
    tenant_id: tid,
    case_id: cid,
    planning_status: p.planning_status ?? "draft",
    planned_procedure_type:
      p.planned_procedure_type !== undefined ? trimOrNull(p.planned_procedure_type) : null,
    planned_session_type:
      p.planned_session_type !== undefined ? trimOrNull(p.planned_session_type) : null,
    planned_zones: p.planned_zones ?? [],
    estimated_grafts_min: p.estimated_grafts_min ?? null,
    estimated_grafts_max: p.estimated_grafts_max ?? null,
    donor_strategy_notes:
      p.donor_strategy_notes !== undefined ? trimOrNull(p.donor_strategy_notes) : null,
    recipient_strategy_notes:
      p.recipient_strategy_notes !== undefined ? trimOrNull(p.recipient_strategy_notes) : null,
    medication_prep_notes:
      p.medication_prep_notes !== undefined ? trimOrNull(p.medication_prep_notes) : null,
    planning_notes: p.planning_notes !== undefined ? trimOrNull(p.planning_notes) : null,
    surgical_plan_summary:
      p.surgical_plan_summary !== undefined ? trimOrNull(p.surgical_plan_summary) : null,
    created_at: now,
    updated_at: now,
  };

  const { error: ie } = await supabase.from("fi_case_surgery_plans").insert(insertPayload);
  if (ie) throw new Error(ie.message);
}
