import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { assertReceptionOsTenantRowScope } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { insertReceptionTaskAuditEvent } from "@/src/lib/receptionOs/receptionTaskAudit.server";
import {
  assertReceptionTaskStatusTransition,
  mapAlertKindToSourceType,
  OPEN_RECEPTION_TASK_STATUSES,
  severityFromString,
  type ReceptionTaskSourceType,
  type ReceptionTaskStatus,
} from "@/src/lib/receptionOs/receptionTaskPolicy";
import type { ReceptionTaskRow } from "@/src/lib/receptionOs/receptionTasks.types";
import type { ReceptionOsSeverity } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";

function mapRow(raw: Record<string, unknown>): ReceptionTaskRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    title: String(raw.title ?? ""),
    description: raw.description != null ? String(raw.description) : null,
    source_type: String(raw.source_type) as ReceptionTaskSourceType,
    severity: severityFromString(String(raw.severity ?? "warning")),
    status: String(raw.status) as ReceptionTaskStatus,
    owner_fi_user_id: raw.owner_fi_user_id != null ? String(raw.owner_fi_user_id) : null,
    due_at: raw.due_at != null ? String(raw.due_at) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    booking_id: raw.booking_id != null ? String(raw.booking_id) : null,
    payment_id: raw.payment_id != null ? String(raw.payment_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    source_alert_kind: raw.source_alert_kind != null ? String(raw.source_alert_kind) : null,
    source_ref_id: raw.source_ref_id != null ? String(raw.source_ref_id) : null,
    resolution_notes: raw.resolution_notes != null ? String(raw.resolution_notes) : null,
    internal_notes: raw.internal_notes != null ? String(raw.internal_notes) : null,
    snoozed_until: raw.snoozed_until != null ? String(raw.snoozed_until) : null,
    metadata: raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata) ? (raw.metadata as Record<string, unknown>) : {},
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    resolved_by_fi_user_id: raw.resolved_by_fi_user_id != null ? String(raw.resolved_by_fi_user_id) : null,
    dismissed_by_fi_user_id: raw.dismissed_by_fi_user_id != null ? String(raw.dismissed_by_fi_user_id) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    resolved_at: raw.resolved_at != null ? String(raw.resolved_at) : null,
    dismissed_at: raw.dismissed_at != null ? String(raw.dismissed_at) : null,
  };
}

function extractUuidFromAlertRef(ref: string | null | undefined, prefix: string): string | null {
  if (!ref?.startsWith(prefix)) return null;
  const id = ref.slice(prefix.length).trim();
  return id.length >= 32 ? id : null;
}

function anchorsFromAlert(alert: ReceptionOsActionAlert): Partial<ReceptionTaskRow> {
  const hrefs = alert.hrefs ?? {
    patient: null,
    case: null,
    lead: null,
    consultation: null,
  };
  let payment_id: string | null = extractUuidFromAlertRef(alert.id, "deposit-");
  let booking_id: string | null = extractUuidFromAlertRef(alert.id, "surgery-");
  let consultation_id: string | null = extractUuidFromAlertRef(alert.id, "followup-");
  if (alert.id.startsWith("form-")) {
    consultation_id = consultation_id ?? null;
  }
  return {
    patient_id: hrefs.patient ?? null,
    case_id: hrefs.case ?? null,
    lead_id: hrefs.lead ?? null,
    booking_id,
    payment_id,
    consultation_id: hrefs.consultation ?? consultation_id,
    source_alert_kind: alert.kind,
    source_ref_id: alert.id,
  };
}

export async function loadReceptionTasksForTenant(tenantId: string, limit = 120): Promise<ReceptionTaskRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_reception_tasks")
    .select("*")
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = mapRow(r as Record<string, unknown>);
    assertReceptionOsTenantRowScope(tid, row.tenant_id, "fi_reception_tasks");
    return row;
  });
}

export async function loadOpenReceptionTasksForTenant(tenantId: string): Promise<ReceptionTaskRow[]> {
  const all = await loadReceptionTasksForTenant(tenantId, 200);
  return all.filter((t) => OPEN_RECEPTION_TASK_STATUSES.includes(t.status));
}

export async function getReceptionTaskById(tenantId: string, taskId: string): Promise<ReceptionTaskRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(taskId, "taskId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_reception_tasks").select("*").eq("tenant_id", tid).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = mapRow(data as Record<string, unknown>);
  assertReceptionOsTenantRowScope(tid, row.tenant_id, "fi_reception_tasks");
  return row;
}

export async function createReceptionTaskFromAlert(opts: {
  tenantId: string;
  alert: ReceptionOsActionAlert;
  actorFiUserId?: string | null;
  ownerFiUserId?: string | null;
  dueAt?: string | null;
}): Promise<ReceptionTaskRow> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const anchors = anchorsFromAlert(opts.alert);
  const sourceType = mapAlertKindToSourceType(opts.alert.kind);

  const existing = anchors.source_ref_id
    ? await getReceptionTaskBySourceRef(tid, anchors.source_ref_id)
    : null;
  if (existing) return existing;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_reception_tasks")
    .insert({
      tenant_id: tid,
      title: opts.alert.title,
      description: opts.alert.detail,
      source_type: sourceType,
      severity: opts.alert.severity,
      status: "open",
      owner_fi_user_id: opts.ownerFiUserId?.trim() || null,
      due_at: opts.dueAt?.trim() || null,
      patient_id: anchors.patient_id,
      case_id: anchors.case_id,
      lead_id: anchors.lead_id,
      booking_id: anchors.booking_id,
      payment_id: anchors.payment_id,
      consultation_id: anchors.consultation_id,
      source_alert_kind: anchors.source_alert_kind,
      source_ref_id: anchors.source_ref_id,
      created_by_fi_user_id: opts.actorFiUserId?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapRow(data as Record<string, unknown>);
  await insertReceptionTaskAuditEvent({
    tenantId: tid,
    taskId: row.id,
    eventKind: "created",
    actorFiUserId: opts.actorFiUserId,
    detail: { source_alert_kind: opts.alert.kind, source_ref_id: opts.alert.id },
  });
  return row;
}

async function getReceptionTaskBySourceRef(tenantId: string, sourceRefId: string): Promise<ReceptionTaskRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_reception_tasks")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("source_ref_id", sourceRefId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

async function updateReceptionTask(
  tenantId: string,
  taskId: string,
  patch: Record<string, unknown>,
  audit: { eventKind: Parameters<typeof insertReceptionTaskAuditEvent>[0]["eventKind"]; actorFiUserId?: string | null; detail?: Record<string, unknown> },
): Promise<ReceptionTaskRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(taskId, "taskId").trim();
  const existing = await getReceptionTaskById(tid, id);
  if (!existing) throw new Error("Reception task not found.");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_reception_tasks").update(patch).eq("tenant_id", tid).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  const row = mapRow(data as Record<string, unknown>);
  await insertReceptionTaskAuditEvent({
    tenantId: tid,
    taskId: id,
    eventKind: audit.eventKind,
    actorFiUserId: audit.actorFiUserId,
    detail: audit.detail ?? {},
  });
  return row;
}

export async function assignReceptionTask(opts: {
  tenantId: string;
  taskId: string;
  ownerFiUserId: string | null;
  actorFiUserId?: string | null;
}): Promise<ReceptionTaskRow> {
  return updateReceptionTask(
    opts.tenantId,
    opts.taskId,
    { owner_fi_user_id: opts.ownerFiUserId?.trim() || null },
    { eventKind: "assigned", actorFiUserId: opts.actorFiUserId, detail: { owner_fi_user_id: opts.ownerFiUserId } },
  );
}

export async function snoozeReceptionTask(opts: {
  tenantId: string;
  taskId: string;
  snoozedUntil: string;
  actorFiUserId?: string | null;
}): Promise<ReceptionTaskRow> {
  const existing = await getReceptionTaskById(opts.tenantId, opts.taskId);
  if (!existing) throw new Error("Reception task not found.");
  assertReceptionTaskStatusTransition(existing.status, "snoozed");
  return updateReceptionTask(
    opts.tenantId,
    opts.taskId,
    { status: "snoozed", snoozed_until: opts.snoozedUntil },
    { eventKind: "snoozed", actorFiUserId: opts.actorFiUserId, detail: { snoozed_until: opts.snoozedUntil } },
  );
}

export async function setReceptionTaskStatus(opts: {
  tenantId: string;
  taskId: string;
  status: ReceptionTaskStatus;
  actorFiUserId?: string | null;
  resolutionNotes?: string | null;
}): Promise<ReceptionTaskRow> {
  const existing = await getReceptionTaskById(opts.tenantId, opts.taskId);
  if (!existing) throw new Error("Reception task not found.");
  assertReceptionTaskStatusTransition(existing.status, opts.status);

  const patch: Record<string, unknown> = { status: opts.status };
  if (opts.status === "resolved") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by_fi_user_id = opts.actorFiUserId?.trim() || null;
    if (opts.resolutionNotes?.trim()) patch.resolution_notes = opts.resolutionNotes.trim();
  }
  if (opts.status === "dismissed") {
    patch.dismissed_at = new Date().toISOString();
    patch.dismissed_by_fi_user_id = opts.actorFiUserId?.trim() || null;
  }
  if (opts.status === "in_progress") {
    patch.snoozed_until = null;
  }

  const eventKind =
    opts.status === "resolved" ? "resolved" : opts.status === "dismissed" ? "dismissed" : "status_changed";

  return updateReceptionTask(opts.tenantId, opts.taskId, patch, {
    eventKind,
    actorFiUserId: opts.actorFiUserId,
    detail: { previous_status: existing.status, next_status: opts.status },
  });
}

export async function addReceptionTaskNote(opts: {
  tenantId: string;
  taskId: string;
  note: string;
  actorFiUserId?: string | null;
}): Promise<ReceptionTaskRow> {
  const note = opts.note.trim();
  if (!note) throw new Error("Note is required.");
  const existing = await getReceptionTaskById(opts.tenantId, opts.taskId);
  if (!existing) throw new Error("Reception task not found.");
  const merged = existing.internal_notes?.trim() ? `${existing.internal_notes.trim()}\n${note}` : note;
  return updateReceptionTask(
    opts.tenantId,
    opts.taskId,
    { internal_notes: merged },
    { eventKind: "note_added", actorFiUserId: opts.actorFiUserId, detail: { note } },
  );
}

export function mapSeverityForTask(severity: ReceptionOsSeverity): ReceptionOsSeverity {
  return severity;
}
