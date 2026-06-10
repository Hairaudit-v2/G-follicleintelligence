import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { parseProcedureMilestones } from "@/src/lib/cases/procedureDayMilestonesModel";

export type CaseProcedureRow = {
  id: string;
  tenant_id: string;
  case_id: string;
  procedure_date: string | null;
  procedure_status: string;
  surgeon_user_id: string | null;
  /** Circulating / recovery nurse (`fi_users`). */
  nurse_user_id: string | null;
  /** Surgical technicians / assistants (`fi_users` ids). */
  technician_user_ids: string[];
  /** Legacy mixed team list (still supported). Prefer nurse + technicians + surgeon for new records. */
  team_member_user_ids: string[];
  /** Milestone key → completed-at ISO timestamp. */
  procedure_milestones: Record<string, string>;
  procedure_location: string | null;
  procedure_room: string | null;
  start_time: string | null;
  finish_time: string | null;
  punch_size: string | null;
  extraction_method: string | null;
  implantation_method: string | null;
  medication_notes: string | null;
  intraoperative_notes: string | null;
  grafts_extracted: number | null;
  grafts_implanted: number | null;
  hairs_implanted: number | null;
  graft_handling_notes: string | null;
  complications_notes: string | null;
  completion_summary: string | null;
  created_at: string;
  updated_at: string;
};

/** Shared select list for `fi_case_procedures` (SurgeryOS procedure day). */
export const FI_CASE_PROCEDURE_SELECT_COLUMNS =
  "id, tenant_id, case_id, procedure_date, procedure_status, surgeon_user_id, nurse_user_id, technician_user_ids, team_member_user_ids, procedure_milestones, procedure_location, procedure_room, start_time, finish_time, punch_size, extraction_method, implantation_method, medication_notes, intraoperative_notes, grafts_extracted, grafts_implanted, hairs_implanted, graft_handling_notes, complications_notes, completion_summary, created_at, updated_at";

export type FiUserPickerOption = {
  id: string;
  email: string | null;
  role: string | null;
};

function parseTeamIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out;
}

export function mapCaseProcedureRowFromRecord(r: Record<string, unknown>): CaseProcedureRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    case_id: String(r.case_id),
    procedure_date: r.procedure_date != null ? String(r.procedure_date) : null,
    procedure_status: String(r.procedure_status ?? "scheduled"),
    surgeon_user_id: r.surgeon_user_id != null ? String(r.surgeon_user_id) : null,
    nurse_user_id: r.nurse_user_id != null ? String(r.nurse_user_id) : null,
    technician_user_ids: parseTeamIds(r.technician_user_ids),
    team_member_user_ids: parseTeamIds(r.team_member_user_ids),
    procedure_milestones: parseProcedureMilestones(r.procedure_milestones),
    procedure_location: r.procedure_location != null ? String(r.procedure_location) : null,
    procedure_room: r.procedure_room != null ? String(r.procedure_room) : null,
    start_time: r.start_time != null ? String(r.start_time) : null,
    finish_time: r.finish_time != null ? String(r.finish_time) : null,
    punch_size: r.punch_size != null ? String(r.punch_size) : null,
    extraction_method: r.extraction_method != null ? String(r.extraction_method) : null,
    implantation_method: r.implantation_method != null ? String(r.implantation_method) : null,
    medication_notes: r.medication_notes != null ? String(r.medication_notes) : null,
    intraoperative_notes: r.intraoperative_notes != null ? String(r.intraoperative_notes) : null,
    grafts_extracted: r.grafts_extracted != null ? Number(r.grafts_extracted) : null,
    grafts_implanted: r.grafts_implanted != null ? Number(r.grafts_implanted) : null,
    hairs_implanted: r.hairs_implanted != null ? Number(r.hairs_implanted) : null,
    graft_handling_notes: r.graft_handling_notes != null ? String(r.graft_handling_notes) : null,
    complications_notes: r.complications_notes != null ? String(r.complications_notes) : null,
    completion_summary: r.completion_summary != null ? String(r.completion_summary) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function loadProcedureDayForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<CaseProcedureRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data: row, error } = await supabase
    .from("fi_case_procedures")
    .select(FI_CASE_PROCEDURE_SELECT_COLUMNS)
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  return mapCaseProcedureRowFromRecord(row as Record<string, unknown>);
}

/** Tenant `fi_users` rows for surgeon / team pickers (Stage 5C). */
export async function loadFiUsersForProcedureTeamPicker(
  tenantId: string,
  client?: SupabaseClient
): Promise<FiUserPickerOption[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");

  const { data: rows, error } = await supabase
    .from("fi_users")
    .select("id, email, role")
    .eq("tenant_id", tid)
    .order("email", { ascending: true, nullsFirst: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (rows ?? []).map((u) => {
    const x = u as { id: string; email: string | null; role: string | null };
    return {
      id: String(x.id),
      email: x.email != null ? String(x.email) : null,
      role: x.role != null ? String(x.role) : null,
    };
  });
}
