import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { FiEventRow } from "./idempotency";
import {
  buildStaleProcessingReclaimPayloadPatch,
  isFiEventProcessingLeaseStale,
} from "./processingLeaseCore";

export type FiEventIngestionGate =
  | { kind: "terminal_processed"; row: FiEventRow }
  | { kind: "already_processing"; row: FiEventRow }
  | { kind: "reclaimed_stale"; row: FiEventRow }
  | { kind: "should_process"; row: FiEventRow; created: boolean };

function eventColumns() {
  return "id, tenant_id, event_type, source_system, source_event_id, occurred_at, payload_json, status, error_text, created_at, updated_at";
}

async function loadFiEventById(
  tenantId: string,
  eventId: string,
  client?: SupabaseClient
): Promise<FiEventRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_events")
    .select(eventColumns())
    .eq("tenant_id", tenantId.trim())
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FiEventRow | null) ?? null;
}

export async function tryReclaimStaleFiEventProcessing(input: {
  tenantId: string;
  eventId: string;
  expectedUpdatedAt: string;
  existingPayload: Record<string, unknown>;
  client?: SupabaseClient;
  nowMs?: number;
}): Promise<{ reclaimed: true; row: FiEventRow } | { reclaimed: false }> {
  const supabase = input.client ?? supabaseAdmin();
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const tid = input.tenantId.trim();

  if (!isFiEventProcessingLeaseStale(input.expectedUpdatedAt, nowMs)) {
    return { reclaimed: false };
  }

  const nextPayload = buildStaleProcessingReclaimPayloadPatch({
    existingPayload: input.existingPayload,
    previousProcessingAt: input.expectedUpdatedAt,
    reclaimedAt: nowIso,
  });

  const { data, error } = await supabase
    .from("fi_events")
    .update({
      status: "processing",
      updated_at: nowIso,
      error_text: null,
      payload_json: nextPayload,
    })
    .eq("id", input.eventId)
    .eq("tenant_id", tid)
    .eq("status", "processing")
    .eq("updated_at", input.expectedUpdatedAt)
    .select(eventColumns())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { reclaimed: false };
  return { reclaimed: true, row: data as unknown as FiEventRow };
}

/**
 * Shared FI event ingestion gate for hairaudit / hli / iiohr handlers.
 * Terminal processed|ignored stay idempotent; fresh processing short-circuits;
 * stale processing is atomically reclaimed for safe retry.
 */
export async function resolveFiEventIngestionGate(
  eventLog: { created: boolean; row: FiEventRow },
  opts?: { nowMs?: number; client?: SupabaseClient }
): Promise<FiEventIngestionGate> {
  const nowMs = opts?.nowMs ?? Date.now();
  let row = eventLog.row;

  if (!eventLog.created && ["processed", "ignored"].includes(row.status)) {
    return { kind: "terminal_processed", row };
  }

  if (!eventLog.created && row.status === "processing") {
    if (!isFiEventProcessingLeaseStale(row.updated_at, nowMs)) {
      return { kind: "already_processing", row };
    }

    const reclaim = await tryReclaimStaleFiEventProcessing({
      tenantId: row.tenant_id,
      eventId: row.id,
      expectedUpdatedAt: row.updated_at,
      existingPayload: row.payload_json ?? {},
      client: opts?.client,
      nowMs,
    });

    if (reclaim.reclaimed) {
      return { kind: "reclaimed_stale", row: reclaim.row };
    }

    const reloaded = await loadFiEventById(row.tenant_id, row.id, opts?.client);
    if (reloaded) row = reloaded;

    if (["processed", "ignored"].includes(row.status)) {
      return { kind: "terminal_processed", row };
    }
    if (row.status === "processing" && !isFiEventProcessingLeaseStale(row.updated_at, nowMs)) {
      return { kind: "already_processing", row };
    }
  }

  return { kind: "should_process", row, created: eventLog.created };
}
