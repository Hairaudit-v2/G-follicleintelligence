/**
 * FI-UX-REBUILD-1 S4.4 — Pipeline batch enrichment loaders (service-role, no session gate).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PipelineCommunicationHintInput,
  PipelineConsultationInput,
  PipelineReminderInput,
  PipelineTaskInput,
} from "@/src/lib/crm/pipelinePresentation.types";

export const PIPELINE_BATCH_CHUNK_SIZE = 130;

function chunkIds<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size) as T[]);
  return out;
}

export async function loadCrmTasksByLeadIds(
  tenantId: string,
  leadIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, PipelineTaskInput[]>> {
  const out = new Map<string, PipelineTaskInput[]>();
  if (!leadIds.length) return out;

  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const seen = new Set<string>();

  for (const batch of chunkIds(leadIds, PIPELINE_BATCH_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("fi_crm_tasks")
      .select("id, lead_id, title, status, due_at, completed_at, assignee_user_id")
      .eq("tenant_id", tid)
      .in("lead_id", batch)
      .order("due_at", { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const taskId = String(r.id);
      if (seen.has(taskId)) continue;
      seen.add(taskId);

      const leadId = String(r.lead_id ?? "");
      if (!leadId) continue;

      const task: PipelineTaskInput = {
        taskId,
        leadId,
        title: String(r.title ?? "").trim() || "Follow-up",
        status: String(r.status ?? "open"),
        dueAtIso: r.due_at != null ? String(r.due_at) : null,
        completedAtIso: r.completed_at != null ? String(r.completed_at) : null,
        assigneeUserId: r.assignee_user_id != null ? String(r.assignee_user_id) : null,
      };

      const list = out.get(leadId) ?? [];
      list.push(task);
      out.set(leadId, list);
    }
  }

  for (const [leadId, tasks] of out) {
    tasks.sort((a, b) => {
      const da = a.dueAtIso ? Date.parse(a.dueAtIso) : Number.MAX_SAFE_INTEGER;
      const db = b.dueAtIso ? Date.parse(b.dueAtIso) : Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return a.taskId.localeCompare(b.taskId);
    });
    out.set(leadId, tasks);
  }

  return out;
}

export async function loadCrmCommunicationHintsByLeadIds(
  tenantId: string,
  leadIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, PipelineCommunicationHintInput[]>> {
  const out = new Map<string, PipelineCommunicationHintInput[]>();
  if (!leadIds.length) return out;

  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const latestByLead = new Map<string, PipelineCommunicationHintInput>();

  for (const batch of chunkIds(leadIds, PIPELINE_BATCH_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("fi_crm_lead_communications")
      .select("id, lead_id, next_follow_up_at, communication_type, outcome")
      .eq("tenant_id", tid)
      .in("lead_id", batch)
      .not("next_follow_up_at", "is", null)
      .is("archived_at", null);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const leadId = String(r.lead_id ?? "");
      const nextFollowUpAtIso = r.next_follow_up_at != null ? String(r.next_follow_up_at) : null;
      if (!leadId || !nextFollowUpAtIso) continue;

      const hint: PipelineCommunicationHintInput = {
        communicationId: String(r.id),
        leadId,
        nextFollowUpAtIso,
        channel: r.communication_type != null ? String(r.communication_type) : null,
        outcome: r.outcome != null ? String(r.outcome) : null,
      };

      const prev = latestByLead.get(leadId);
      if (!prev) {
        latestByLead.set(leadId, hint);
        continue;
      }
      const prevMs = Date.parse(prev.nextFollowUpAtIso ?? "");
      const nextMs = Date.parse(nextFollowUpAtIso);
      if (nextMs >= prevMs) latestByLead.set(leadId, hint);
    }
  }

  for (const [leadId, hint] of latestByLead) {
    out.set(leadId, [hint]);
  }
  return out;
}

export async function loadConsultationBookingsByLeadIds(
  tenantId: string,
  leadIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, PipelineConsultationInput[]>> {
  const out = new Map<string, PipelineConsultationInput[]>();
  if (!leadIds.length) return out;

  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  for (const batch of chunkIds(leadIds, PIPELINE_BATCH_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("fi_bookings")
      .select("id, lead_id, start_at, booking_status, cancelled_at, booking_type, metadata")
      .eq("tenant_id", tid)
      .in("lead_id", batch)
      .eq("booking_type", "consultation")
      .order("start_at", { ascending: true });

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const leadId = String(r.lead_id ?? "");
      if (!leadId) continue;

      const meta =
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {};
      const consultationId =
        meta.consultation_id != null
          ? String(meta.consultation_id)
          : meta.consultationId != null
            ? String(meta.consultationId)
            : null;

      const booking: PipelineConsultationInput = {
        bookingId: String(r.id),
        consultationId,
        startAtIso: String(r.start_at),
        status: String(r.booking_status ?? "scheduled"),
        cancelledAtIso: r.cancelled_at != null ? String(r.cancelled_at) : null,
      };

      const list = out.get(leadId) ?? [];
      list.push(booking);
      out.set(leadId, list);
    }
  }

  return out;
}

async function loadReminderTemplateNames(
  supabase: SupabaseClient,
  tenantId: string,
  templateIds: readonly string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!templateIds.length) return out;

  for (const batch of chunkIds(templateIds, PIPELINE_BATCH_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("fi_reminder_templates")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as { id: string; name: string };
      out.set(String(r.id), String(r.name ?? "").trim());
    }
  }
  return out;
}

export async function loadReminderJobsByLeadIds(
  tenantId: string,
  leadIds: readonly string[],
  client?: SupabaseClient
): Promise<Map<string, PipelineReminderInput[]>> {
  const out = new Map<string, PipelineReminderInput[]>();
  if (!leadIds.length) return out;

  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const rawJobs: Array<{
    reminderId: string;
    leadId: string;
    scheduledAtIso: string;
    status: string;
    templateId: string;
  }> = [];

  for (const batch of chunkIds(leadIds, PIPELINE_BATCH_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("fi_reminder_jobs")
      .select("id, lead_id, scheduled_at, status, template_id")
      .eq("tenant_id", tid)
      .in("lead_id", batch)
      .order("scheduled_at", { ascending: true });

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const leadId = String(r.lead_id ?? "");
      if (!leadId) continue;
      rawJobs.push({
        reminderId: String(r.id),
        leadId,
        scheduledAtIso: String(r.scheduled_at),
        status: String(r.status ?? "pending"),
        templateId: String(r.template_id),
      });
    }
  }

  const tplIds = Array.from(new Set(rawJobs.map((j) => j.templateId)));
  const tplNames = await loadReminderTemplateNames(supabase, tid, tplIds);

  for (const j of rawJobs) {
    const reminder: PipelineReminderInput = {
      reminderId: j.reminderId,
      leadId: j.leadId,
      scheduledAtIso: j.scheduledAtIso,
      status: j.status,
      label: tplNames.get(j.templateId) ?? null,
    };
    const list = out.get(j.leadId) ?? [];
    list.push(reminder);
    out.set(j.leadId, list);
  }

  return out;
}
