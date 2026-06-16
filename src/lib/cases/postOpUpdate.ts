import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import type { FollowUpUpsertPatch, PostOpTrackingUpsertPatch } from "./postOpTypes";

const POST_OP_MIGRATION_HINT =
  "Post-op tables are not deployed yet. Run: npm run supabase:push:post-op-tracking (with SUPABASE_DB_PASSWORD set).";

function throwPostOpDbError(error: { message?: string }): never {
  if (isSupabaseMissingRelationError(error)) throw new Error(POST_OP_MIGRATION_HINT);
  throw new Error(error.message ?? "Database error.");
}

async function assertPatientImageIdsBelongToCase(
  supabase: SupabaseClient,
  tenantId: string,
  caseId: string,
  imageIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(imageIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return;

  const { data, error } = await supabase
    .from("fi_patient_images")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .in("id", unique);

  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r) => String((r as { id: string }).id)));
  for (const id of unique) {
    if (!found.has(id)) throw new Error(`Image ${id} is not linked to this case for this tenant.`);
  }
}

export type UpsertPostOpTrackingParams = {
  tenantId: string;
  caseId: string;
  patch: PostOpTrackingUpsertPatch;
};

/**
 * Creates or updates `fi_case_post_op_tracking`. Verifies `fi_cases` belongs to the tenant.
 * Service-role Supabase only.
 */
export async function upsertPostOpTrackingForCase(params: UpsertPostOpTrackingParams, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(params.caseId, "caseId");
  const p = params.patch;

  const { data: c, error: ce } = await supabase.from("fi_cases").select("id").eq("tenant_id", tid).eq("id", cid).is("deleted_at", null).maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!c) throw new Error("Case not found for tenant.");

  const { data: existing, error: le } = await supabase
    .from("fi_case_post_op_tracking")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .maybeSingle();
  if (le) throwPostOpDbError(le);

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { updated_at: now };

  if (p.post_op_status !== undefined) updatePayload.post_op_status = p.post_op_status;
  if (p.instructions_given !== undefined) updatePayload.instructions_given = p.instructions_given;
  if (p.aftercare_notes !== undefined) {
    updatePayload.aftercare_notes = p.aftercare_notes?.trim() ? p.aftercare_notes.trim() : null;
  }
  if (p.donor_recovery_notes !== undefined) {
    updatePayload.donor_recovery_notes = p.donor_recovery_notes?.trim() ? p.donor_recovery_notes.trim() : null;
  }
  if (p.recipient_recovery_notes !== undefined) {
    updatePayload.recipient_recovery_notes = p.recipient_recovery_notes?.trim() ? p.recipient_recovery_notes.trim() : null;
  }
  if (p.complication_notes !== undefined) {
    updatePayload.complication_notes = p.complication_notes?.trim() ? p.complication_notes.trim() : null;
  }
  if (p.patient_satisfaction_score !== undefined) {
    updatePayload.patient_satisfaction_score = p.patient_satisfaction_score;
  }
  if (p.outcome_notes !== undefined) {
    updatePayload.outcome_notes = p.outcome_notes?.trim() ? p.outcome_notes.trim() : null;
  }

  if (existing?.id) {
    const { error: ue } = await supabase
      .from("fi_case_post_op_tracking")
      .update(updatePayload)
      .eq("tenant_id", tid)
      .eq("case_id", cid);
    if (ue) throwPostOpDbError(ue);
    return;
  }

  const trimOrNull = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

  const insertPayload = {
    tenant_id: tid,
    case_id: cid,
    post_op_status: p.post_op_status ?? "not_started",
    instructions_given: p.instructions_given ?? false,
    aftercare_notes: p.aftercare_notes !== undefined ? trimOrNull(p.aftercare_notes) : null,
    donor_recovery_notes: p.donor_recovery_notes !== undefined ? trimOrNull(p.donor_recovery_notes) : null,
    recipient_recovery_notes: p.recipient_recovery_notes !== undefined ? trimOrNull(p.recipient_recovery_notes) : null,
    complication_notes: p.complication_notes !== undefined ? trimOrNull(p.complication_notes) : null,
    patient_satisfaction_score: p.patient_satisfaction_score !== undefined ? p.patient_satisfaction_score : null,
    outcome_notes: p.outcome_notes !== undefined ? trimOrNull(p.outcome_notes) : null,
    created_at: now,
    updated_at: now,
  };

  const { error: ie } = await supabase.from("fi_case_post_op_tracking").insert(insertPayload);
  if (ie) throwPostOpDbError(ie);
}

export type UpsertFollowUpParams = {
  tenantId: string;
  caseId: string;
  patch: FollowUpUpsertPatch;
};

/**
 * Creates or updates `fi_case_follow_ups` for a case. Validates linked image IDs against `fi_patient_images` for the same case.
 * Service-role Supabase only.
 */
export async function upsertFollowUpForCase(params: UpsertFollowUpParams, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(params.caseId, "caseId");
  const p = params.patch;

  const { data: c, error: ce } = await supabase.from("fi_cases").select("id").eq("tenant_id", tid).eq("id", cid).is("deleted_at", null).maybeSingle();
  if (ce) throw new Error(ce.message);
  if (!c) throw new Error("Case not found for tenant.");

  const linkedIdsForWrite = p.linked_image_ids;
  if (linkedIdsForWrite !== undefined) {
    await assertPatientImageIdsBelongToCase(supabase, tid, cid, linkedIdsForWrite);
  }

  const now = new Date().toISOString();

  const dateOrNull = (s: string | null | undefined) => {
    if (s === undefined) return undefined;
    const t = s?.trim();
    if (!t) return null;
    return t.slice(0, 10);
  };

  if (p.id) {
    const { data: row, error: re } = await supabase
      .from("fi_case_follow_ups")
      .select("id")
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .eq("id", p.id)
      .maybeSingle();
    if (re) throwPostOpDbError(re);
    if (!row) throw new Error("Follow-up row not found for this patient.");

    const updatePayload: Record<string, unknown> = { updated_at: now };
    if (linkedIdsForWrite !== undefined) updatePayload.linked_image_ids = linkedIdsForWrite;
    if (p.scheduled_date !== undefined) updatePayload.scheduled_date = dateOrNull(p.scheduled_date);
    if (p.completed_date !== undefined) updatePayload.completed_date = dateOrNull(p.completed_date);
    if (p.follow_up_status !== undefined) updatePayload.follow_up_status = p.follow_up_status;
    if (p.notes !== undefined) updatePayload.notes = p.notes?.trim() ? p.notes.trim() : null;

    const { error: ue } = await supabase.from("fi_case_follow_ups").update(updatePayload).eq("tenant_id", tid).eq("case_id", cid).eq("id", p.id);
    if (ue) throwPostOpDbError(ue);
    return;
  }

  if (!p.checkpoint) throw new Error("checkpoint is required for a new follow-up row.");

  const { data: byCp, error: be } = await supabase
    .from("fi_case_follow_ups")
    .select("id")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .eq("checkpoint", p.checkpoint)
    .maybeSingle();
  if (be) throwPostOpDbError(be);

  if (byCp?.id) {
    const updatePayload: Record<string, unknown> = {
      updated_at: now,
    };
    if (linkedIdsForWrite !== undefined) updatePayload.linked_image_ids = linkedIdsForWrite;
    if (p.scheduled_date !== undefined) updatePayload.scheduled_date = dateOrNull(p.scheduled_date);
    if (p.completed_date !== undefined) updatePayload.completed_date = dateOrNull(p.completed_date);
    if (p.follow_up_status !== undefined) updatePayload.follow_up_status = p.follow_up_status;
    if (p.notes !== undefined) updatePayload.notes = p.notes?.trim() ? p.notes.trim() : null;

    const { error: ue } = await supabase
      .from("fi_case_follow_ups")
      .update(updatePayload)
      .eq("tenant_id", tid)
      .eq("case_id", cid)
      .eq("id", String((byCp as { id: string }).id));
    if (ue) throwPostOpDbError(ue);
    return;
  }

  const insertLinked = linkedIdsForWrite ?? [];
  await assertPatientImageIdsBelongToCase(supabase, tid, cid, insertLinked);

  const insertPayload = {
    tenant_id: tid,
    case_id: cid,
    checkpoint: p.checkpoint,
    scheduled_date: p.scheduled_date !== undefined ? dateOrNull(p.scheduled_date) : null,
    completed_date: p.completed_date !== undefined ? dateOrNull(p.completed_date) : null,
    follow_up_status: p.follow_up_status ?? "pending",
    notes: p.notes !== undefined ? (p.notes?.trim() ? p.notes.trim() : null) : null,
    linked_image_ids: insertLinked,
    created_at: now,
    updated_at: now,
  };

  const { error: ie } = await supabase.from("fi_case_follow_ups").insert(insertPayload);
  if (ie) throwPostOpDbError(ie);
}

export type DeleteFollowUpParams = {
  tenantId: string;
  caseId: string;
  followUpId: string;
};

export async function deleteFollowUpForCase(params: DeleteFollowUpParams, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(params.caseId, "caseId");
  const fid = assertNonEmptyUuid(params.followUpId, "followUpId");

  const { error } = await supabase.from("fi_case_follow_ups").delete().eq("tenant_id", tid).eq("case_id", cid).eq("id", fid);
  if (error) throwPostOpDbError(error);
}
