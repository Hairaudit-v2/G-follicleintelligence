import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isSupabaseMissingRelationError } from "@/src/lib/supabase/missingRelationError";
import type { FollowUpCheckpointValue } from "./postOpTypes";

export type CasePostOpTrackingRow = {
  id: string;
  tenant_id: string;
  case_id: string;
  post_op_status: string;
  instructions_given: boolean;
  aftercare_notes: string | null;
  donor_recovery_notes: string | null;
  recipient_recovery_notes: string | null;
  complication_notes: string | null;
  patient_satisfaction_score: number | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseFollowUpRow = {
  id: string;
  tenant_id: string;
  case_id: string;
  checkpoint: FollowUpCheckpointValue;
  scheduled_date: string | null;
  completed_date: string | null;
  follow_up_status: string;
  notes: string | null;
  linked_image_ids: string[];
  created_at: string;
  updated_at: string;
};

function parseUuidArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
  }
  return out;
}

export async function loadPostOpTrackingForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<CasePostOpTrackingRow | null> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data: row, error } = await supabase
    .from("fi_case_post_op_tracking")
    .select(
      "id, tenant_id, case_id, post_op_status, instructions_given, aftercare_notes, donor_recovery_notes, recipient_recovery_notes, complication_notes, patient_satisfaction_score, outcome_notes, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (!row) return null;

  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    case_id: String(r.case_id),
    post_op_status: String(r.post_op_status ?? "not_started"),
    instructions_given: Boolean(r.instructions_given),
    aftercare_notes: r.aftercare_notes != null ? String(r.aftercare_notes) : null,
    donor_recovery_notes: r.donor_recovery_notes != null ? String(r.donor_recovery_notes) : null,
    recipient_recovery_notes:
      r.recipient_recovery_notes != null ? String(r.recipient_recovery_notes) : null,
    complication_notes: r.complication_notes != null ? String(r.complication_notes) : null,
    patient_satisfaction_score:
      r.patient_satisfaction_score != null ? Number(r.patient_satisfaction_score) : null,
    outcome_notes: r.outcome_notes != null ? String(r.outcome_notes) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function loadFollowUpsForCase(
  tenantId: string,
  caseId: string,
  client?: SupabaseClient
): Promise<CaseFollowUpRow[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(caseId, "caseId");

  const { data: rows, error } = await supabase
    .from("fi_case_follow_ups")
    .select(
      "id, tenant_id, case_id, checkpoint, scheduled_date, completed_date, follow_up_status, notes, linked_image_ids, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("checkpoint", { ascending: true });

  if (error) {
    if (isSupabaseMissingRelationError(error)) return [];
    throw new Error(error.message);
  }

  return (rows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const checkpoint = String(r.checkpoint ?? "") as FollowUpCheckpointValue;
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      case_id: String(r.case_id),
      checkpoint,
      scheduled_date: r.scheduled_date != null ? String(r.scheduled_date).slice(0, 10) : null,
      completed_date: r.completed_date != null ? String(r.completed_date).slice(0, 10) : null,
      follow_up_status: String(r.follow_up_status ?? "pending"),
      notes: r.notes != null ? String(r.notes) : null,
      linked_image_ids: parseUuidArray(r.linked_image_ids),
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
    };
  });
}
