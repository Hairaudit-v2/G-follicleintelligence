/**
 * Optional admin-triggered foundation backfill from stored fi_events rows.
 * Reconstructs a minimal FiEventEnvelope from DB + fi_event_links + global tables.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestFiEventLink, type FiEventRow } from "@/lib/fi/events/idempotency";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiEventEnvelope, FiEventType, FiSourceSystem } from "@/src/types/fi-events";
import { dualWriteFoundationFromFiEvent } from "./dualWriteEvent";
import type { FoundationSupabase } from "./types";

export type BackfillFoundationBatchResult = {
  scanned: number;
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function eventColumns() {
  return "id, tenant_id, event_type, source_system, source_event_id, occurred_at, payload_json, status, error_text, created_at, updated_at";
}

async function loadFiEventRow(supabase: SupabaseClient, eventId: string): Promise<FiEventRow | null> {
  const { data, error } = await supabase.from("fi_events").select(eventColumns()).eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FiEventRow | null) ?? null;
}

/**
 * Build envelope for dual-write from persisted fi_events row + link + global rows.
 */
export async function reconstructFiEventEnvelopeForDualWrite(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ envelope: FiEventEnvelope; resolution: { fiCaseId: string | null; globalPatientId: string | null; globalCaseId: string | null } } | null> {
  const row = await loadFiEventRow(supabase, eventId);
  if (!row || row.status !== "processed") return null;

  const link = await getLatestFiEventLink(supabase, eventId);
  if (!link.fi_case_id) return null;

  let source_case_id: string | undefined;
  let source_patient_id: string | undefined;

  if (link.global_case_id) {
    const { data: gc } = await supabase
      .from("fi_global_cases")
      .select("source_case_id")
      .eq("id", link.global_case_id)
      .maybeSingle();
    if (gc?.source_case_id) source_case_id = String(gc.source_case_id);
  }
  if (!source_case_id && link.fi_case_id) {
    const { data: c } = await supabase
      .from("fi_cases")
      .select("external_id, metadata")
      .eq("id", link.fi_case_id)
      .maybeSingle();
    const meta = c?.metadata as Record<string, unknown> | undefined;
    const metaCase = meta && typeof meta.source_case_id === "string" ? meta.source_case_id : undefined;
    if (metaCase) source_case_id = metaCase;
    else if (c?.external_id && typeof c.external_id === "string") {
      const ext = c.external_id;
      const idx = ext.indexOf(":");
      if (idx > 0) source_case_id = ext.slice(idx + 1);
    }
  }

  if (link.global_patient_id) {
    const { data: gp } = await supabase
      .from("fi_global_patients")
      .select("source_patient_id")
      .eq("id", link.global_patient_id)
      .maybeSingle();
    if (gp?.source_patient_id) source_patient_id = String(gp.source_patient_id);
  }

  const identifiers =
    source_case_id || source_patient_id
      ? {
          ...(source_patient_id ? { source_patient_id: source_patient_id } : {}),
          ...(source_case_id ? { source_case_id: source_case_id } : {}),
        }
      : undefined;

  const envelope: FiEventEnvelope = {
    tenant_id: row.tenant_id,
    event_type: row.event_type as FiEventType,
    source_system: row.source_system as FiSourceSystem,
    source_event_id: row.source_event_id,
    occurred_at: row.occurred_at,
    identifiers,
    payload:
      row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json)
        ? (row.payload_json as Record<string, unknown>)
        : {},
  };

  return {
    envelope,
    resolution: {
      fiCaseId: link.fi_case_id,
      globalPatientId: link.global_patient_id,
      globalCaseId: link.global_case_id,
    },
  };
}

async function eventIdsWithTimeline(supabase: SupabaseClient, tenantId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("fi_timeline_events")
      .select("fi_event_id")
      .eq("tenant_id", tenantId)
      .not("fi_event_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    if (batch.length === 0) break;
    for (const r of batch) {
      const id = (r as { fi_event_id: string }).fi_event_id;
      if (id) ids.add(id);
    }
    if (batch.length < page) break;
    from += page;
    if (from > 200_000) break;
  }
  return ids;
}

/**
 * Backfill foundation dual-write for processed events missing a timeline row with matching fi_event_id.
 * Admin-trigger only; idempotent via dual-write helpers.
 */
export async function backfillFoundationFromProcessedEvents(params: {
  tenantId: string;
  batchSize?: number;
  client?: FoundationSupabase;
}): Promise<BackfillFoundationBatchResult> {
  const supabase = params.client ?? supabaseAdmin();
  const tenantId = params.tenantId.trim();
  const batchSize = Math.min(50, Math.max(1, params.batchSize ?? 50));

  const withTimeline = await eventIdsWithTimeline(supabase, tenantId);

  const { data: candidates, error } = await supabase
    .from("fi_events")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "processed")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const scanned = (candidates ?? []).length;
  const toRun: string[] = [];
  for (const row of candidates ?? []) {
    const id = String((row as { id: string }).id);
    if (!withTimeline.has(id)) toRun.push(id);
    if (toRun.length >= batchSize) break;
  }

  let attempted = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const eventId of toRun) {
    attempted += 1;
    const rebuilt = await reconstructFiEventEnvelopeForDualWrite(supabase, eventId);
    if (!rebuilt) {
      skipped += 1;
      continue;
    }
    const res = await dualWriteFoundationFromFiEvent({
      tenantId,
      fiEventId: eventId,
      envelope: rebuilt.envelope,
      resolution: rebuilt.resolution,
      supabase,
    });
    if (res.ok) succeeded += 1;
    else {
      failed += 1;
      if (errors.length < 15) {
        errors.push(`${eventId}: ${res.skipped_reason ?? res.error ?? "unknown"}`);
      }
    }
  }

  return { scanned, attempted, succeeded, skipped, failed, errors };
}
