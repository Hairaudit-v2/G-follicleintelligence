/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — activity + audit event queries (server).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import type { PilotControlEventKind } from "../pilotControlContracts";

function adminClient(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? supabaseAdmin();
}

export type PilotControlEventRow = {
  id: string;
  tenantId: string;
  programmeId: string | null;
  enrolmentId: string | null;
  patientId: string | null;
  eventKind: string;
  actorType: string;
  actorId: string | null;
  sourceModule: string;
  correlationId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

function mapEvent(row: Record<string, unknown>): PilotControlEventRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programmeId: row.programme_id != null ? String(row.programme_id) : null,
    enrolmentId: row.enrolment_id != null ? String(row.enrolment_id) : null,
    patientId: row.patient_id != null ? String(row.patient_id) : null,
    eventKind: String(row.event_kind),
    actorType: String(row.actor_type ?? "system"),
    actorId: row.actor_id != null ? String(row.actor_id) : null,
    sourceModule: String(row.source_module),
    correlationId: row.correlation_id != null ? String(row.correlation_id) : null,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
  };
}

export async function queryPilotControlActivity(args: {
  tenantId: string;
  programmeId: string;
  from: string;
  to: string;
  patientId?: string;
  eventType?: string;
  actorType?: string;
  sourceModule?: string;
  page?: number;
  pageSize?: number;
  supabase?: SupabaseClient;
}): Promise<{ items: PilotControlEventRow[]; total: number }> {
  const db = adminClient(args.supabase);
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.programmeId, "programmeId");
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 25;

  let query = db
    .from("fi_pilot_control_events")
    .select(
      "id, tenant_id, programme_id, enrolment_id, patient_id, event_kind, actor_type, actor_id, source_module, correlation_id, payload, created_at",
      { count: "exact" }
    )
    .eq("tenant_id", tid)
    .eq("programme_id", pid)
    .gte("created_at", args.from)
    .lte("created_at", args.to)
    .order("created_at", { ascending: false });

  if (args.patientId) query = query.eq("patient_id", args.patientId);
  if (args.eventType) query = query.eq("event_kind", args.eventType);
  if (args.actorType) query = query.eq("actor_type", args.actorType);
  if (args.sourceModule) query = query.eq("source_module", args.sourceModule);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = (data ?? [])
    .map((r) => mapEvent(r as Record<string, unknown>))
    .filter((e) => e.tenantId === tid);

  return { items, total: count ?? items.length };
}

/**
 * Record a safe audit event. Never include clinical content / message bodies / export rows.
 */
export async function recordPilotControlAuditEvent(args: {
  tenantId: string;
  programmeId?: string | null;
  enrolmentId?: string | null;
  patientId?: string | null;
  eventKind: PilotControlEventKind | string;
  actorType?: "system" | "staff" | "patient" | "integration";
  actorId?: string | null;
  correlationId?: string | null;
  payload?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<void> {
  const db = adminClient(args.supabase);
  const payload = { ...(args.payload ?? {}) };
  // Strip obviously sensitive keys if callers misbehave.
  for (const key of Object.keys(payload)) {
    if (/message|body|content|amount|token|card|pathology|image_url/i.test(key)) {
      delete payload[key];
    }
  }

  const { error } = await db.from("fi_pilot_control_events").insert({
    tenant_id: args.tenantId,
    programme_id: args.programmeId ?? null,
    enrolment_id: args.enrolmentId ?? null,
    patient_id: args.patientId ?? null,
    event_kind: args.eventKind,
    actor_type: args.actorType ?? "staff",
    actor_id: args.actorId ?? null,
    source_module: "pilot_enrolment",
    correlation_id: args.correlationId ?? null,
    payload,
  });

  if (error) {
    // Audit must not break the read path — log-shaped swallow.
    console.error("pilot_control_audit_write_failed", error.message?.slice(0, 200));
  }
}
