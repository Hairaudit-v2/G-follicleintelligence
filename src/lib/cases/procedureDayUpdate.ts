import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { assertProcedureDayTeamAssignments } from "@/src/lib/staff/assertStaffClinicallyAvailable.server";
import type { ProcedureDayUpsertPatch } from "./procedureDayTypes";

export type UpsertProcedureDayParams = {
  tenantId: string;
  caseId: string;
  patch: ProcedureDayUpsertPatch;
};

async function assertFiUserIdsBelongToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return;

  const { data, error } = await supabase.from("fi_users").select("id").eq("tenant_id", tenantId).in("id", unique);
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r) => String((r as { id: string }).id)));
  for (const id of unique) {
    if (!found.has(id)) throw new Error(`User ${id} is not a member of this tenant.`);
  }
}

/**
 * Creates or updates `fi_case_procedures` for a case. Verifies `fi_cases` and referenced `fi_users` belong to the tenant.
 * Service-role Supabase only.
 */
export async function upsertProcedureDayForCase(params: UpsertProcedureDayParams, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(params.caseId, "caseId");
  const p = params.patch;

  const { data: c, error: ce } = await supabase.from("fi_cases").select("id").eq("tenant_id", tid).eq("id", cid).maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!c) throw new Error("Case not found for tenant.");

  const idsToCheck: string[] = [];
  if (p.surgeon_user_id) idsToCheck.push(p.surgeon_user_id);
  if (p.nurse_user_id) idsToCheck.push(p.nurse_user_id);
  if (p.technician_user_ids) idsToCheck.push(...p.technician_user_ids);
  if (p.team_member_user_ids) idsToCheck.push(...p.team_member_user_ids);
  await assertFiUserIdsBelongToTenant(supabase, tid, idsToCheck);
  await assertProcedureDayTeamAssignments(
    tid,
    {
      surgeonUserId: p.surgeon_user_id ?? null,
      nurseUserId: p.nurse_user_id ?? null,
      technicianUserIds: p.technician_user_ids ?? null,
      teamMemberUserIds: p.team_member_user_ids ?? null,
    },
    supabase
  );

  const { data: existing, error: le } = await supabase
    .from("fi_case_procedures")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .maybeSingle();
  if (le) throw new Error(le.message);

  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (p.procedure_date !== undefined) {
    updatePayload.procedure_date = p.procedure_date?.trim() ? p.procedure_date.trim().slice(0, 10) : null;
  }
  if (p.procedure_status !== undefined) updatePayload.procedure_status = p.procedure_status;
  if (p.surgeon_user_id !== undefined) updatePayload.surgeon_user_id = p.surgeon_user_id;
  if (p.nurse_user_id !== undefined) updatePayload.nurse_user_id = p.nurse_user_id;
  if (p.technician_user_ids !== undefined) updatePayload.technician_user_ids = p.technician_user_ids;
  if (p.team_member_user_ids !== undefined) updatePayload.team_member_user_ids = p.team_member_user_ids;
  if (p.procedure_milestones !== undefined) updatePayload.procedure_milestones = p.procedure_milestones;
  if (p.procedure_location !== undefined) {
    updatePayload.procedure_location = p.procedure_location?.trim() ? p.procedure_location.trim() : null;
  }
  if (p.procedure_room !== undefined) {
    updatePayload.procedure_room = p.procedure_room?.trim() ? p.procedure_room.trim() : null;
  }
  if (p.start_time !== undefined) {
    updatePayload.start_time = p.start_time?.trim() ? p.start_time.trim() : null;
  }
  if (p.finish_time !== undefined) {
    updatePayload.finish_time = p.finish_time?.trim() ? p.finish_time.trim() : null;
  }
  if (p.punch_size !== undefined) updatePayload.punch_size = p.punch_size?.trim() ? p.punch_size.trim() : null;
  if (p.extraction_method !== undefined) {
    updatePayload.extraction_method = p.extraction_method?.trim() ? p.extraction_method.trim() : null;
  }
  if (p.implantation_method !== undefined) {
    updatePayload.implantation_method = p.implantation_method?.trim() ? p.implantation_method.trim() : null;
  }
  if (p.medication_notes !== undefined) {
    updatePayload.medication_notes = p.medication_notes?.trim() ? p.medication_notes.trim() : null;
  }
  if (p.intraoperative_notes !== undefined) {
    updatePayload.intraoperative_notes = p.intraoperative_notes?.trim() ? p.intraoperative_notes.trim() : null;
  }
  if (p.grafts_extracted !== undefined) updatePayload.grafts_extracted = p.grafts_extracted;
  if (p.grafts_implanted !== undefined) updatePayload.grafts_implanted = p.grafts_implanted;
  if (p.hairs_implanted !== undefined) updatePayload.hairs_implanted = p.hairs_implanted;
  if (p.graft_handling_notes !== undefined) {
    updatePayload.graft_handling_notes = p.graft_handling_notes?.trim() ? p.graft_handling_notes.trim() : null;
  }
  if (p.complications_notes !== undefined) {
    updatePayload.complications_notes = p.complications_notes?.trim() ? p.complications_notes.trim() : null;
  }
  if (p.completion_summary !== undefined) {
    updatePayload.completion_summary = p.completion_summary?.trim() ? p.completion_summary.trim() : null;
  }

  if (existing?.id) {
    const { error: ue } = await supabase
      .from("fi_case_procedures")
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
    procedure_date: p.procedure_date !== undefined ? (p.procedure_date?.trim() ? p.procedure_date.trim().slice(0, 10) : null) : null,
    procedure_status: p.procedure_status ?? "scheduled",
    surgeon_user_id: p.surgeon_user_id !== undefined ? p.surgeon_user_id : null,
    nurse_user_id: p.nurse_user_id !== undefined ? p.nurse_user_id : null,
    technician_user_ids: p.technician_user_ids ?? [],
    team_member_user_ids: p.team_member_user_ids ?? [],
    procedure_milestones: p.procedure_milestones ?? {},
    procedure_location: p.procedure_location !== undefined ? trimOrNull(p.procedure_location) : null,
    procedure_room: p.procedure_room !== undefined ? trimOrNull(p.procedure_room) : null,
    start_time: p.start_time !== undefined ? (p.start_time?.trim() ? p.start_time.trim() : null) : null,
    finish_time: p.finish_time !== undefined ? (p.finish_time?.trim() ? p.finish_time.trim() : null) : null,
    punch_size: p.punch_size !== undefined ? trimOrNull(p.punch_size) : null,
    extraction_method: p.extraction_method !== undefined ? trimOrNull(p.extraction_method) : null,
    implantation_method: p.implantation_method !== undefined ? trimOrNull(p.implantation_method) : null,
    medication_notes: p.medication_notes !== undefined ? trimOrNull(p.medication_notes) : null,
    intraoperative_notes: p.intraoperative_notes !== undefined ? trimOrNull(p.intraoperative_notes) : null,
    grafts_extracted: p.grafts_extracted ?? null,
    grafts_implanted: p.grafts_implanted ?? null,
    hairs_implanted: p.hairs_implanted ?? null,
    graft_handling_notes: p.graft_handling_notes !== undefined ? trimOrNull(p.graft_handling_notes) : null,
    complications_notes: p.complications_notes !== undefined ? trimOrNull(p.complications_notes) : null,
    completion_summary: p.completion_summary !== undefined ? trimOrNull(p.completion_summary) : null,
    created_at: now,
    updated_at: now,
  };

  const { error: ie } = await supabase.from("fi_case_procedures").insert(insertPayload);
  if (ie) throw new Error(ie.message);
}
