import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import type { CrmKanbanLeadCard, CrmShellLeadListItem } from "./types";
import { CRM_TASK_ACTIVE_STATUS_VALUES } from "./crmTaskPolicy";

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size) as T[]);
  return out;
}

function msDaysBetween(fromIso: string, toMs: number): number {
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((toMs - t) / 86_400_000));
}

function isHighValuePriority(priority: string | null | undefined): boolean {
  if (!priority?.trim()) return false;
  const p = priority.trim().toLowerCase();
  return p === "high" || p === "urgent" || p === "p1" || p === "critical";
}

/**
 * Batch-loads clinical rows, stage-entry times, activity maxima, and overdue task counts for CRM kanban cards.
 * Call only after CRM shell access checks (service role).
 */
export async function enrichCrmKanbanCards(
  tenantId: string,
  items: CrmShellLeadListItem[],
  client?: SupabaseClient
): Promise<CrmKanbanLeadCard[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const now = Date.now();
  if (items.length === 0) return [];

  const leadIds = items.map((i) => i.lead.id);
  const patientIds = Array.from(
    new Set(items.map((i) => i.lead.patient_id).filter((x): x is string => !!x))
  );

  const clinicalByPatient = new Map<
    string,
    {
      norwood_scale: string | null;
      ludwig_scale: string | null;
      hairline_pattern: string | null;
      primary_concern: string | null;
      primary_hair_concern: string | null;
    }
  >();

  for (const batch of chunk(patientIds, 120)) {
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from("fi_patient_clinical_details")
      .select(
        "patient_id, norwood_scale, ludwig_scale, hairline_pattern, primary_concern, primary_hair_concern"
      )
      .eq("tenant_id", tid)
      .in("patient_id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const pid = r.patient_id != null ? String(r.patient_id) : "";
      if (!pid) continue;
      clinicalByPatient.set(pid, {
        norwood_scale: r.norwood_scale != null ? String(r.norwood_scale) : null,
        ludwig_scale: r.ludwig_scale != null ? String(r.ludwig_scale) : null,
        hairline_pattern: r.hairline_pattern != null ? String(r.hairline_pattern) : null,
        primary_concern: r.primary_concern != null ? String(r.primary_concern) : null,
        primary_hair_concern:
          r.primary_hair_concern != null ? String(r.primary_hair_concern) : null,
      });
    }
  }

  const stageEnteredByLead = new Map<string, string>();
  const historyByLead = new Map<string, { to_stage_id: string; changed_at: string }[]>();
  for (const batch of chunk(leadIds, 150)) {
    const { data, error } = await supabase
      .from("fi_crm_lead_stage_history")
      .select("lead_id, to_stage_id, changed_at")
      .eq("tenant_id", tid)
      .in("lead_id", batch);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { lead_id: string; to_stage_id: string; changed_at: string }[];
    for (const row of rows) {
      const lid = String(row.lead_id);
      const list = historyByLead.get(lid) ?? [];
      list.push({ to_stage_id: String(row.to_stage_id), changed_at: String(row.changed_at) });
      historyByLead.set(lid, list);
    }
  }
  for (const item of items) {
    const lid = item.lead.id;
    const cur = item.lead.current_stage_id;
    if (!cur) continue;
    const rows = historyByLead.get(lid);
    if (!rows?.length) continue;
    const sorted = [...rows].sort(
      (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    );
    const hit = sorted.find((r) => r.to_stage_id === cur);
    if (hit) stageEnteredByLead.set(lid, hit.changed_at);
  }

  const lastActivityByLead = new Map<string, string>();
  for (const batch of chunk(leadIds, 150)) {
    const { data, error } = await supabase
      .from("fi_crm_activity_events")
      .select("lead_id, occurred_at")
      .eq("tenant_id", tid)
      .in("lead_id", batch);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as { lead_id: string; occurred_at: string };
      const lid = String(r.lead_id);
      const prev = lastActivityByLead.get(lid);
      const o = String(r.occurred_at);
      if (!prev || new Date(o).getTime() > new Date(prev).getTime()) {
        lastActivityByLead.set(lid, o);
      }
    }
  }

  const overdueCountByLead = new Map<string, number>();
  const activeStatuses = [...CRM_TASK_ACTIVE_STATUS_VALUES];
  const nowIso = new Date().toISOString();
  for (const batch of chunk(leadIds, 120)) {
    const { data, error } = await supabase
      .from("fi_crm_tasks")
      .select("lead_id")
      .eq("tenant_id", tid)
      .in("lead_id", batch)
      .in("status", activeStatuses)
      .not("due_at", "is", null)
      .lt("due_at", nowIso)
      .is("completed_at", null);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const lid = String((row as { lead_id: string }).lead_id);
      overdueCountByLead.set(lid, (overdueCountByLead.get(lid) ?? 0) + 1);
    }
  }

  return items.map((item) => {
    const pid = item.lead.patient_id;
    const clin = pid ? clinicalByPatient.get(pid) : undefined;
    const clinicalSummaryLine = clin
      ? formatClinicalScalesSummary({
          norwood_scale: clin.norwood_scale,
          ludwig_scale: clin.ludwig_scale,
          hairline_pattern: clin.hairline_pattern,
          primary_concern: clin.primary_concern ?? clin.primary_hair_concern,
        })
      : null;

    const primaryConcernLine = (() => {
      const pc = clin?.primary_concern?.trim();
      if (pc) return pc.length > 72 ? `${pc.slice(0, 69)}…` : pc;
      const ph = clin?.primary_hair_concern?.trim();
      if (ph) return ph.length > 72 ? `${ph.slice(0, 69)}…` : ph;
      return null;
    })();

    const stageEnteredAtIso = stageEnteredByLead.get(item.lead.id) ?? null;
    const lastEv = lastActivityByLead.get(item.lead.id);
    const lu = item.lead.updated_at;
    const lastActivityAtIso = (() => {
      if (!lastEv) return lu;
      const a = new Date(lastEv).getTime();
      const b = new Date(lu).getTime();
      return Number.isFinite(a) && Number.isFinite(b) && a > b ? lastEv : lu;
    })();

    const daysInStage =
      item.lead.current_stage_id && stageEnteredAtIso != null
        ? msDaysBetween(stageEnteredAtIso, now)
        : item.lead.current_stage_id
          ? msDaysBetween(item.lead.created_at, now)
          : null;

    return {
      ...item,
      clinicalSummaryLine,
      norwoodScale: clin?.norwood_scale ?? null,
      ludwigScale: clin?.ludwig_scale ?? null,
      primaryConcernLine,
      daysInStage,
      stageEnteredAtIso,
      lastActivityAtIso,
      overdueTaskCount: overdueCountByLead.get(item.lead.id) ?? 0,
      isHighValue: isHighValuePriority(item.lead.priority),
    };
  });
}
