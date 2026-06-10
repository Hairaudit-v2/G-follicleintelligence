import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import { FI_CASE_PROCEDURE_SELECT_COLUMNS, mapCaseProcedureRowFromRecord, type CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import { plannedZoneRowSchema, type PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";
import type { FollowUpCheckpointValue } from "@/src/lib/cases/postOpTypes";
import { isFollowUpCheckpoint } from "@/src/lib/cases/postOpTypes";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";

export type CasesIndexExtensionBundle = {
  plansByCaseId: Map<string, CaseSurgeryPlanRow>;
  proceduresByCaseId: Map<string, CaseProcedureRow>;
  postOpByCaseId: Map<string, CasePostOpTrackingRow>;
  followUpsByCaseId: Map<string, CaseFollowUpRow[]>;
  imageCountByCaseId: Map<string, number>;
  bookingCountByCaseId: Map<string, number>;
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

function parseUuidArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out;
}

function mapSurgeryPlan(r: Record<string, unknown>): CaseSurgeryPlanRow {
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

function mapPostOp(r: Record<string, unknown>): CasePostOpTrackingRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    case_id: String(r.case_id),
    post_op_status: String(r.post_op_status ?? "not_started"),
    instructions_given: Boolean(r.instructions_given),
    aftercare_notes: r.aftercare_notes != null ? String(r.aftercare_notes) : null,
    donor_recovery_notes: r.donor_recovery_notes != null ? String(r.donor_recovery_notes) : null,
    recipient_recovery_notes: r.recipient_recovery_notes != null ? String(r.recipient_recovery_notes) : null,
    complication_notes: r.complication_notes != null ? String(r.complication_notes) : null,
    patient_satisfaction_score: r.patient_satisfaction_score != null ? Number(r.patient_satisfaction_score) : null,
    outcome_notes: r.outcome_notes != null ? String(r.outcome_notes) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function mapFollowUp(raw: Record<string, unknown>): CaseFollowUpRow {
  const cp = String(raw.checkpoint ?? "");
  const checkpoint = (isFollowUpCheckpoint(cp) ? cp : "day_1") as FollowUpCheckpointValue;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    case_id: String(raw.case_id),
    checkpoint,
    scheduled_date: raw.scheduled_date != null ? String(raw.scheduled_date).slice(0, 10) : null,
    completed_date: raw.completed_date != null ? String(raw.completed_date).slice(0, 10) : null,
    follow_up_status: String(raw.follow_up_status ?? "pending"),
    notes: raw.notes != null ? String(raw.notes) : null,
    linked_image_ids: parseUuidArray(raw.linked_image_ids),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

/**
 * Batch-loads Stage 5B–5D rows and media/booking counts for a set of case ids (tenant-scoped).
 */
export async function loadCasesIndexExtensionBundle(
  tenantId: string,
  caseIds: string[],
  client?: SupabaseClient
): Promise<CasesIndexExtensionBundle> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const ids = Array.from(new Set(caseIds.map((id) => id.trim()).filter(Boolean)));
  const empty = (): CasesIndexExtensionBundle => ({
    plansByCaseId: new Map(),
    proceduresByCaseId: new Map(),
    postOpByCaseId: new Map(),
    followUpsByCaseId: new Map(),
    imageCountByCaseId: new Map(),
    bookingCountByCaseId: new Map(),
  });
  if (ids.length === 0) return empty();

  const [
    { data: planRows, error: pe },
    { data: procRows, error: prE },
    { data: postRows, error: poE },
    { data: fuRows, error: fuE },
    { data: imgRows, error: imgE },
    { data: bookRows, error: bkE },
  ] = await Promise.all([
    supabase
      .from("fi_case_surgery_plans")
      .select(
        "id, tenant_id, case_id, planning_status, planned_procedure_type, planned_session_type, planned_zones, estimated_grafts_min, estimated_grafts_max, donor_strategy_notes, recipient_strategy_notes, medication_prep_notes, planning_notes, surgical_plan_summary, created_at, updated_at"
      )
      .eq("tenant_id", tid)
      .in("case_id", ids),
    supabase.from("fi_case_procedures").select(FI_CASE_PROCEDURE_SELECT_COLUMNS).eq("tenant_id", tid).in("case_id", ids),
    supabase
      .from("fi_case_post_op_tracking")
      .select(
        "id, tenant_id, case_id, post_op_status, instructions_given, aftercare_notes, donor_recovery_notes, recipient_recovery_notes, complication_notes, patient_satisfaction_score, outcome_notes, created_at, updated_at"
      )
      .eq("tenant_id", tid)
      .in("case_id", ids),
    supabase
      .from("fi_case_follow_ups")
      .select(
        "id, tenant_id, case_id, checkpoint, scheduled_date, completed_date, follow_up_status, notes, linked_image_ids, created_at, updated_at"
      )
      .eq("tenant_id", tid)
      .in("case_id", ids),
    supabase.from("fi_patient_images").select("case_id").eq("tenant_id", tid).in("case_id", ids),
    supabase.from("fi_bookings").select("case_id").eq("tenant_id", tid).in("case_id", ids),
  ]);

  if (pe) throw new Error(pe.message);
  if (prE) throw new Error(prE.message);
  if (poE && !isSupabaseMissingRelationError(poE)) throw new Error(poE.message);
  if (fuE && !isSupabaseMissingRelationError(fuE)) throw new Error(fuE.message);
  if (imgE) throw new Error(imgE.message);
  if (bkE) throw new Error(bkE.message);

  const plansByCaseId = new Map<string, CaseSurgeryPlanRow>();
  for (const row of planRows ?? []) {
    const r = row as Record<string, unknown>;
    const p = mapSurgeryPlan(r);
    plansByCaseId.set(p.case_id, p);
  }

  const proceduresByCaseId = new Map<string, CaseProcedureRow>();
  for (const row of procRows ?? []) {
    const r = row as Record<string, unknown>;
    const p = mapCaseProcedureRowFromRecord(r);
    proceduresByCaseId.set(p.case_id, p);
  }

  const postOpByCaseId = new Map<string, CasePostOpTrackingRow>();
  for (const row of postRows ?? []) {
    const r = row as Record<string, unknown>;
    const p = mapPostOp(r);
    postOpByCaseId.set(p.case_id, p);
  }

  const followUpsByCaseId = new Map<string, CaseFollowUpRow[]>();
  for (const row of fuRows ?? []) {
    const r = row as Record<string, unknown>;
    const f = mapFollowUp(r);
    const list = followUpsByCaseId.get(f.case_id) ?? [];
    list.push(f);
    followUpsByCaseId.set(f.case_id, list);
  }

  const imageCountByCaseId = new Map<string, number>();
  for (const id of ids) imageCountByCaseId.set(id, 0);
  for (const row of imgRows ?? []) {
    const cid = String((row as { case_id: string }).case_id);
    imageCountByCaseId.set(cid, (imageCountByCaseId.get(cid) ?? 0) + 1);
  }

  const bookingCountByCaseId = new Map<string, number>();
  for (const id of ids) bookingCountByCaseId.set(id, 0);
  for (const row of bookRows ?? []) {
    const cid = String((row as { case_id: string }).case_id);
    bookingCountByCaseId.set(cid, (bookingCountByCaseId.get(cid) ?? 0) + 1);
  }

  return {
    plansByCaseId,
    proceduresByCaseId,
    postOpByCaseId,
    followUpsByCaseId,
    imageCountByCaseId,
    bookingCountByCaseId,
  };
}
