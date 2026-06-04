import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
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

export async function createCrmTask(params: CreateCrmTaskParams, client?: SupabaseClient): Promise<FiCrmTaskRow> {
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

  const { data, error } = await supabase
    .from("fi_crm_tasks")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      patient_id: patientId,
      case_id: caseId,
      title,
      description: params.description?.trim() || null,
      task_type: (params.taskType ?? "follow_up").trim() || "follow_up",
      status: (params.status ?? "open").trim() || "open",
      due_at: params.dueAt?.trim() || null,
      assignee_user_id: params.assigneeUserId?.trim() || null,
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
