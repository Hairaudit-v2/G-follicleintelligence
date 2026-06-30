import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  assertReceptionPilotFeedbackTenantScope,
  sanitizeReceptionPilotFeedbackContext,
  type ReceptionPilotFeedbackContext,
  type ReceptionPilotFeedbackKind,
  type ReceptionPilotFeedbackRow,
} from "@/src/lib/receptionOs/receptionPilotFeedbackModel";
import { isMissingDatabaseRelationError } from "@/src/lib/receptionOs/receptionOsLoaderResilience";

export async function insertReceptionPilotFeedback(opts: {
  tenantId: string;
  profileId?: string | null;
  feedbackKind: ReceptionPilotFeedbackKind;
  context?: ReceptionPilotFeedbackContext;
}): Promise<{ feedbackId: string }> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const ctx = sanitizeReceptionPilotFeedbackContext(opts.context);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_reception_pilot_feedback")
    .insert({
      tenant_id: tid,
      profile_id: opts.profileId?.trim() || null,
      feedback_kind: opts.feedbackKind,
      operating_mode: ctx.operatingMode,
      widget_key: ctx.widgetKey,
      task_id: ctx.taskId,
      alert_kind: ctx.alertKind,
      source_ref_id: ctx.sourceRefId,
      note: ctx.note,
      metadata: ctx.metadata,
    })
    .select("id, tenant_id")
    .single();

  if (error) throw new Error(error.message);
  const row = data as { id: string; tenant_id: string };
  assertReceptionPilotFeedbackTenantScope(tid, row.tenant_id);
  return { feedbackId: row.id };
}

export async function loadReceptionPilotFeedbackForPeriod(
  tenantId: string,
  periodStartIso: string,
  periodEndIso: string
): Promise<ReceptionPilotFeedbackRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_reception_pilot_feedback")
    .select("*")
    .eq("tenant_id", tid)
    .gte("created_at", periodStartIso)
    .lt("created_at", periodEndIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((raw) =>
    serializeReceptionPilotFeedbackRow(raw as Record<string, unknown>)
  );
}

function serializeReceptionPilotFeedbackRow(
  raw: Record<string, unknown>
): ReceptionPilotFeedbackRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    profile_id: raw.profile_id ? String(raw.profile_id) : null,
    feedback_kind: raw.feedback_kind as ReceptionPilotFeedbackRow["feedback_kind"],
    operating_mode: (raw.operating_mode as ReceptionPilotFeedbackRow["operating_mode"]) ?? null,
    widget_key: raw.widget_key ? String(raw.widget_key) : null,
    task_id: raw.task_id ? String(raw.task_id) : null,
    alert_kind: raw.alert_kind ? String(raw.alert_kind) : null,
    source_ref_id: raw.source_ref_id ? String(raw.source_ref_id) : null,
    note: raw.note ? String(raw.note) : null,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at),
  };
}
