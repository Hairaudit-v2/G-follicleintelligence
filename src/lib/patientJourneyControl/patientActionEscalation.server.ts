/**
 * FI-PATIENT-APP-P1 — overdue patient action escalation.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { createPatientNotification } from "./patientNotificationFeed.server";

export type PatientActionEscalationOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
  graceMs?: number;
};

export function isActionOverdue(input: {
  status: string;
  dueAt?: string | null;
  nowIso?: string;
  graceMs?: number;
}): boolean {
  const status = String(input.status ?? "").trim();
  if (!["open", "in_progress"].includes(status)) return false;
  const dueAt = input.dueAt?.trim();
  if (!dueAt) return false;
  const due = Date.parse(dueAt);
  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  if (!Number.isFinite(due) || !Number.isFinite(now)) return false;
  const grace = input.graceMs ?? 0;
  return now > due + grace;
}

export async function escalateOverduePatientActions(
  args?: { tenantId?: string; limit?: number },
  options?: PatientActionEscalationOptions
): Promise<{ escalated: number; actionIds: string[] }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const now = options?.nowIso ?? new Date().toISOString();
  const limit = args?.limit ?? 100;

  let query = supabase
    .from("fi_patient_actions")
    .select("*")
    .in("status", ["open", "in_progress"])
    .not("due_at", "is", null)
    .lte("due_at", now)
    .limit(limit);
  if (args?.tenantId) query = query.eq("tenant_id", args.tenantId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const actionIds: string[] = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    if (
      !isActionOverdue({
        status: String(row.status ?? ""),
        dueAt: row.due_at != null ? String(row.due_at) : null,
        nowIso: now,
        graceMs: options?.graceMs,
      })
    ) {
      continue;
    }
    const id = String(row.id);
    const tenantId = String(row.tenant_id);
    const patientId = String(row.patient_id);
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    if (meta.escalated_at) continue;

    await createPatientNotification(
      {
        tenantId,
        patientId,
        eventType: "action_overdue",
        title: "Action overdue",
        body: "You have an overdue task in your Action Centre.",
        actionId: id,
        resourceType: row.resource_type != null ? String(row.resource_type) : null,
        resourceId: row.resource_id != null ? String(row.resource_id) : null,
        dedupeKey: `action_overdue:${id}`,
      },
      { supabase, nowIso: now }
    );

    await supabase
      .from("fi_patient_actions")
      .update({
        metadata: { ...meta, escalated_at: now },
        updated_at: now,
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    await supabase.from("fi_patient_action_history").insert({
      tenant_id: tenantId,
      patient_id: patientId,
      action_id: id,
      event: "escalated",
      from_status: String(row.status ?? ""),
      to_status: String(row.status ?? ""),
      detail: { reason: "overdue", at: now },
    });

    actionIds.push(id);
  }

  return { escalated: actionIds.length, actionIds };
}