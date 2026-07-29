/**
 * FI-PATIENT-APP-P1 — patient action engine (fi_patient_actions + history).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  buildActionCreateInput,
  buildPatientActionsGatewayResponse,
  toGatewayActionItem,
  type PatientActionCreateInput,
  type PatientGatewayActionItem,
  type PatientGatewayActionsResponse,
} from "./patientActionEngineCore";
import { patientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayGateCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "@/src/lib/patientPortal/patientGatewayTypes";

export type PatientActionEngineOptions = {
  supabase?: SupabaseClient;
  nowIso?: string;
};

type ActionRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  kind: string;
  status: string;
  priority: number;
  due_at: string | null;
  completed_at: string | null;
  title: string;
  body: string | null;
  deep_link_key: string | null;
  resource_type: string | null;
  resource_id: string | null;
  milestone_key: string | null;
  dedupe_key: string | null;
  created_by_event: string | null;
  completed_by_event: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function mapRow(raw: Record<string, unknown>): ActionRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: String(raw.patient_id),
    kind: String(raw.kind ?? ""),
    status: String(raw.status ?? "open"),
    priority: Number(raw.priority) || 0,
    due_at: raw.due_at != null ? String(raw.due_at) : null,
    completed_at: raw.completed_at != null ? String(raw.completed_at) : null,
    title: String(raw.title ?? ""),
    body: raw.body != null ? String(raw.body) : null,
    deep_link_key: raw.deep_link_key != null ? String(raw.deep_link_key) : null,
    resource_type: raw.resource_type != null ? String(raw.resource_type) : null,
    resource_id: raw.resource_id != null ? String(raw.resource_id) : null,
    milestone_key: raw.milestone_key != null ? String(raw.milestone_key) : null,
    dedupe_key: raw.dedupe_key != null ? String(raw.dedupe_key) : null,
    created_by_event: raw.created_by_event != null ? String(raw.created_by_event) : null,
    completed_by_event: raw.completed_by_event != null ? String(raw.completed_by_event) : null,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

async function appendHistory(
  supabase: SupabaseClient,
  row: ActionRow,
  event: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("fi_patient_action_history").insert({
    tenant_id: row.tenant_id,
    patient_id: row.patient_id,
    action_id: row.id,
    event,
    from_status: detail.from_status ?? null,
    to_status: detail.to_status ?? row.status,
    detail,
  });
}

export async function listPatientActionsForGateway(
  ctx: PatientGatewayContext,
  options?: PatientActionEngineOptions
): Promise<PatientGatewayActionsResponse | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_actions")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return patientGatewayDeny("misconfigured", 500, "Unable to load actions.");
  }
  const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  return buildPatientActionsGatewayResponse(rows, options?.nowIso);
}

export async function getPatientActionForGateway(
  ctx: PatientGatewayContext,
  actionId: string,
  options?: PatientActionEngineOptions
): Promise<{ ok: true; action: PatientGatewayActionItem } | PatientGatewayDeny> {
  const supabase = options?.supabase ?? supabaseAdmin();
  let aid: string;
  try {
    aid = assertNonEmptyUuid(actionId, "actionId");
  } catch {
    return patientGatewayDeny("not_found", 404, "Action not found.");
  }

  const { data, error } = await supabase
    .from("fi_patient_actions")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("id", aid)
    .maybeSingle();
  if (error) return patientGatewayDeny("misconfigured", 500, "Unable to load action.");
  if (!data) return patientGatewayDeny("not_found", 404, "Action not found.");
  const row = mapRow(data as Record<string, unknown>);
  return { ok: true, action: toGatewayActionItem(row, options?.nowIso) };
}

export async function createPatientAction(
  args: {
    tenantId: string;
    patientId: string;
    input: PatientActionCreateInput;
  },
  options?: PatientActionEngineOptions
): Promise<{ ok: true; action: ActionRow; reused: boolean }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const built = buildActionCreateInput(args.input);
  const now = options?.nowIso ?? new Date().toISOString();

  if (built.dedupeKey) {
    const { data: existing } = await supabase
      .from("fi_patient_actions")
      .select("*")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("dedupe_key", built.dedupeKey)
      .in("status", ["open", "in_progress", "waiting_on_clinic", "blocked"])
      .maybeSingle();
    if (existing) {
      return { ok: true, action: mapRow(existing as Record<string, unknown>), reused: true };
    }
  }

  const { data, error } = await supabase
    .from("fi_patient_actions")
    .insert({
      tenant_id: tid,
      patient_id: pid,
      kind: built.kind,
      status: built.status,
      priority: built.priority,
      due_at: built.dueAt,
      title: built.title,
      body: built.body,
      deep_link_key: built.deepLinkKey,
      resource_type: built.resourceType,
      resource_id: built.resourceId,
      milestone_key: built.milestoneKey,
      created_by_event: built.createdByEvent,
      dedupe_key: built.dedupeKey,
      metadata: built.metadata,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapRow(data as Record<string, unknown>);
  await appendHistory(supabase, row, "created", { to_status: row.status });
  return { ok: true, action: row, reused: false };
}

export async function completePatientActionsByKind(
  args: {
    tenantId: string;
    patientId: string;
    kinds: readonly string[];
    completedByEvent?: string | null;
  },
  options?: PatientActionEngineOptions
): Promise<{ completedIds: string[] }> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.patientId, "patientId");
  const now = options?.nowIso ?? new Date().toISOString();
  const kinds = args.kinds.map((k) => String(k).trim()).filter(Boolean);
  if (kinds.length === 0) return { completedIds: [] };

  const { data: openRows, error } = await supabase
    .from("fi_patient_actions")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .in("kind", kinds)
    .in("status", ["open", "in_progress", "waiting_on_clinic", "blocked"]);
  if (error) throw new Error(error.message);

  const completedIds: string[] = [];
  for (const raw of openRows ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const { error: ue } = await supabase
      .from("fi_patient_actions")
      .update({
        status: "completed",
        completed_at: now,
        completed_by_event: args.completedByEvent ?? null,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("tenant_id", tid);
    if (ue) throw new Error(ue.message);
    completedIds.push(row.id);
    await appendHistory(supabase, { ...row, status: "completed" }, "completed", {
      from_status: row.status,
      to_status: "completed",
      completed_by_event: args.completedByEvent ?? null,
    });
  }
  return { completedIds };
}