import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
import {
  assertCrmTaskStatusAllowedForWrite,
  assertCrmTaskTypeAllowed,
  CRM_TASK_STATUS_DONE,
} from "./crmTaskPolicy";
import {
  collectChangedTaskDetailKeys,
  taskDetailSnapshotFromRowLike,
} from "./crmTaskChangedFields";
import { mapFiCrmLeadRow } from "./leadRow";
import type { FiCrmTaskRow } from "./types";
import { assertNonEmptyUuid } from "./validation";

export type CreateCrmTaskParams = {
  tenantId: string;
  leadId: string;
  title: string;
  description?: string | null;
  taskType?: string;
  status?: string;
  dueAt?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  consultationId?: string | null;
  assigneeUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function mapTaskRow(row: Record<string, unknown>): FiCrmTaskRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: String(row.lead_id),
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    consultation_id: row.consultation_id != null ? String(row.consultation_id) : null,
    title: String(row.title),
    description: row.description != null ? String(row.description) : null,
    task_type: String(row.task_type),
    status: String(row.status),
    due_at: row.due_at != null ? String(row.due_at) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    assignee_user_id: row.assignee_user_id != null ? String(row.assignee_user_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function fiUserBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", fiUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function assertOptionalPatientCaseForLead(
  supabase: SupabaseClient,
  tenantId: string,
  lead: { patient_id: string | null; case_id: string | null },
  patientId: string | null,
  caseId: string | null
): Promise<void> {
  if (patientId) {
    const { data, error } = await supabase
      .from("fi_patients")
      .select("tenant_id")
      .eq("id", patientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || String((data as { tenant_id: string }).tenant_id) !== tenantId) {
      throw new Error("patient_id is missing or not in this tenant.");
    }
    if (lead.patient_id && lead.patient_id !== patientId) {
      throw new Error("task patient_id does not match the lead's patient_id.");
    }
  }
  if (caseId) {
    const { data, error } = await supabase
      .from("fi_cases")
      .select("tenant_id")
      .eq("id", caseId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || String((data as { tenant_id: string }).tenant_id) !== tenantId) {
      throw new Error("case_id is missing or not in this tenant.");
    }
    if (lead.case_id && lead.case_id !== caseId) {
      throw new Error("task case_id does not match the lead's case_id.");
    }
  }
}

export async function createCrmTask(
  params: CreateCrmTaskParams,
  client?: SupabaseClient
): Promise<FiCrmTaskRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");

  const { data: leadRow, error: le } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .single();
  if (le || !leadRow) throw new Error(le?.message ?? "Lead not found for tenant.");

  const lead = mapFiCrmLeadRow(leadRow as Record<string, unknown>);
  const patientId = params.patientId?.trim() || null;
  const caseId = params.caseId?.trim() || null;
  await assertOptionalPatientCaseForLead(supabase, tenantId, lead, patientId, caseId);

  const metadata =
    params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? params.metadata
      : {};

  const title = params.title.trim();
  if (!title) throw new Error("Task title is required.");

  const assigneeUserId = params.assigneeUserId?.trim() || null;
  if (assigneeUserId) {
    const ok = await fiUserBelongsToTenant(supabase, tenantId, assigneeUserId);
    if (!ok) throw new Error("Assignee must be a user in this tenant.");
  }

  const taskType = (params.taskType ?? "follow_up").trim() || "follow_up";
  assertCrmTaskTypeAllowed(taskType);
  const status = (params.status ?? "open").trim() || "open";
  assertCrmTaskStatusAllowedForWrite(status);

  let dueAtIso: string | null = params.dueAt?.trim() || null;
  if (dueAtIso) {
    const parsed = Date.parse(dueAtIso);
    if (Number.isNaN(parsed)) throw new Error("Invalid due_at datetime.");
    dueAtIso = new Date(parsed).toISOString();
  }

  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      patient_id: patientId,
      case_id: caseId,
      consultation_id: params.consultationId?.trim() || null,
      title,
      description: params.description?.trim() || null,
      task_type: taskType,
      status,
      due_at: dueAtIso,
      assignee_user_id: assigneeUserId,
      metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const task = mapTaskRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "task.created",
      title: "Task created",
      detail: { task_id: task.id, title: task.title, task_type: task.task_type },
      patientId: task.patient_id,
      caseId: task.case_id,
    },
    supabase
  );

  return task;
}

/**
 * Recent tasks for a lead (newest first).
 */
export async function loadCrmTasksForLead(
  tenantId: string,
  leadId: string,
  opts?: { limit?: number; client?: SupabaseClient }
): Promise<FiCrmTaskRow[]> {
  const supabase: SupabaseClient = opts?.client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);

  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapTaskRow);
}

export async function loadCrmTaskForLead(
  tenantId: string,
  leadId: string,
  taskId: string,
  client?: SupabaseClient
): Promise<FiCrmTaskRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const tidTask = assertNonEmptyUuid(taskId, "taskId");

  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .eq("id", tidTask)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapTaskRow(data as Record<string, unknown>);
}

export type UpdateCrmTaskParams = {
  tenantId: string;
  leadId: string;
  taskId: string;
  title?: string;
  description?: string | null;
  taskType?: string;
  status?: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
};

export async function updateCrmTask(
  params: UpdateCrmTaskParams,
  client?: SupabaseClient
): Promise<FiCrmTaskRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const task = await loadCrmTaskForLead(params.tenantId, params.leadId, params.taskId, supabase);
  if (!task) throw new Error("Task not found for this lead.");

  const hasPatch =
    params.title !== undefined ||
    params.description !== undefined ||
    params.taskType !== undefined ||
    params.status !== undefined ||
    params.dueAt !== undefined ||
    params.assigneeUserId !== undefined;
  if (!hasPatch) throw new Error("No task fields to update.");

  if (task.completed_at) {
    throw new Error("Completed tasks cannot be edited. Reopen the task first.");
  }

  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");

  let nextTitle = task.title;
  if (params.title !== undefined) {
    const t = params.title.trim();
    if (!t) throw new Error("Task title is required.");
    nextTitle = t;
  }

  let nextDesc = task.description;
  if (params.description !== undefined) {
    nextDesc = params.description === null ? null : params.description.trim() || null;
  }

  let nextType = task.task_type;
  if (params.taskType !== undefined) {
    const tt = params.taskType.trim();
    if (tt !== task.task_type) {
      assertCrmTaskTypeAllowed(tt);
    }
    nextType = tt;
  }

  let nextStatus = task.status;
  if (params.status !== undefined) {
    const st = params.status.trim();
    if (st !== task.status) {
      if (st === CRM_TASK_STATUS_DONE) {
        throw new Error("Use the complete action to mark a task done.");
      }
      assertCrmTaskStatusAllowedForWrite(st);
    }
    nextStatus = st;
  }

  let nextDue: string | null = task.due_at;
  if (params.dueAt !== undefined) {
    if (params.dueAt === null || !String(params.dueAt).trim()) {
      nextDue = null;
    } else {
      const raw = String(params.dueAt).trim();
      const parsed = Date.parse(raw);
      if (Number.isNaN(parsed)) throw new Error("Invalid due_at datetime.");
      nextDue = new Date(parsed).toISOString();
    }
  }

  let nextAssignee = task.assignee_user_id;
  if (params.assigneeUserId !== undefined) {
    const aid = params.assigneeUserId === null ? null : params.assigneeUserId.trim() || null;
    if (aid) {
      const ok = await fiUserBelongsToTenant(supabase, tenantId, aid);
      if (!ok) throw new Error("Assignee must be a user in this tenant.");
    }
    nextAssignee = aid;
  }

  const before = taskDetailSnapshotFromRowLike(task);
  const after = taskDetailSnapshotFromRowLike({
    ...task,
    title: nextTitle,
    description: nextDesc,
    task_type: nextType,
    status: nextStatus,
    due_at: nextDue,
    assignee_user_id: nextAssignee,
  });

  const changed = collectChangedTaskDetailKeys(before, after);
  if (changed.length === 0) {
    return task;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .update({
      title: nextTitle,
      description: nextDesc,
      task_type: nextType,
      status: nextStatus,
      due_at: nextDue,
      assignee_user_id: nextAssignee,
      updated_at: nowIso,
    })
    .eq("id", task.id)
    .eq("tenant_id", tenantId)
    .eq("lead_id", task.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapTaskRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId: task.lead_id,
      activityKind: "task.updated",
      title: "Task updated",
      detail: { task_id: updated.id, changed_keys: changed },
      patientId: updated.patient_id,
      caseId: updated.case_id,
    },
    supabase
  );

  return updated;
}

export async function completeCrmTask(
  params: { tenantId: string; leadId: string; taskId: string },
  client?: SupabaseClient
): Promise<FiCrmTaskRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const task = await loadCrmTaskForLead(params.tenantId, params.leadId, params.taskId, supabase);
  if (!task) throw new Error("Task not found for this lead.");
  if (task.completed_at) throw new Error("Task is already completed.");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .update({
      status: CRM_TASK_STATUS_DONE,
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", task.id)
    .eq("tenant_id", task.tenant_id)
    .eq("lead_id", task.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapTaskRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId: task.tenant_id,
      leadId: task.lead_id,
      activityKind: "task.completed",
      title: "Task completed",
      detail: { task_id: updated.id, title: updated.title },
      patientId: updated.patient_id,
      caseId: updated.case_id,
    },
    supabase
  );

  return updated;
}

export async function reopenCrmTask(
  params: { tenantId: string; leadId: string; taskId: string },
  client?: SupabaseClient
): Promise<FiCrmTaskRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const task = await loadCrmTaskForLead(params.tenantId, params.leadId, params.taskId, supabase);
  if (!task) throw new Error("Task not found for this lead.");
  if (!task.completed_at) throw new Error("Task is not completed.");

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .update({
      status: "open",
      completed_at: null,
      updated_at: nowIso,
    })
    .eq("id", task.id)
    .eq("tenant_id", task.tenant_id)
    .eq("lead_id", task.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapTaskRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId: task.tenant_id,
      leadId: task.lead_id,
      activityKind: "task.reopened",
      title: "Task reopened",
      detail: { task_id: updated.id, title: updated.title },
      patientId: updated.patient_id,
      caseId: updated.case_id,
    },
    supabase
  );

  return updated;
}
