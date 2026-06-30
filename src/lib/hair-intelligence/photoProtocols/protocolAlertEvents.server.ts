import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { buildPhotoProtocolAlerts } from "./protocolAlerts";
import {
  assertPhotoProtocolAlertStatusTransition,
  mapComputedAlertToUpsertCandidate,
  mergePhotoProtocolAlertUpsertCandidate,
  type ExistingAlertEventRow,
  type PhotoProtocolAlertUpsertCandidate,
} from "./protocolAlertEventsPure";
import {
  loadPhotoProtocolDatasetForTenant,
  type PhotoProtocolAnalyticsFilters,
} from "./photoProtocolAnalyticsLoader.server";
import type { HliPhotoProtocolAlertEvent, HliPhotoProtocolAlertEventStatus } from "./types";

const UPSERT_CHUNK = 80;

export type PhotoProtocolAlertEventsFilters = PhotoProtocolAnalyticsFilters & {
  /** Filter persisted rows by `hli_photo_protocol_alert_events.status`. */
  alert_status?: HliPhotoProtocolAlertEventStatus | "all" | null;
  /** Filter persisted rows by `hli_photo_protocol_alert_events.alert_type`. */
  alert_event_type?: string | null;
  /** Filter persisted rows by `hli_photo_protocol_alert_events.severity`. */
  alert_severity?: HliPhotoProtocolAlertEvent["severity"] | null;
  limit?: number;
};

function mapAlertEventRow(r: Record<string, unknown>): HliPhotoProtocolAlertEvent {
  return {
    id: String(r.id),
    source_system: String(r.source_system) as HliPhotoProtocolAlertEvent["source_system"],
    source_record_id: r.source_record_id != null ? String(r.source_record_id) : null,
    tenant_id: r.tenant_id != null ? String(r.tenant_id) : null,
    clinic_id: r.clinic_id != null ? String(r.clinic_id) : null,
    patient_id: r.patient_id != null ? String(r.patient_id) : null,
    case_id: r.case_id != null ? String(r.case_id) : null,
    protocol_session_id: String(r.protocol_session_id),
    alert_type: String(r.alert_type) as HliPhotoProtocolAlertEvent["alert_type"],
    severity: String(r.severity) as HliPhotoProtocolAlertEvent["severity"],
    status: String(r.status) as HliPhotoProtocolAlertEvent["status"],
    message: String(r.message),
    recommended_action: r.recommended_action != null ? String(r.recommended_action) : null,
    payload:
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : {},
    idempotency_key: String(r.idempotency_key),
    first_detected_at: String(r.first_detected_at),
    last_detected_at: String(r.last_detected_at),
    acknowledged_at: r.acknowledged_at != null ? String(r.acknowledged_at) : null,
    acknowledged_by_user_id:
      r.acknowledged_by_user_id != null ? String(r.acknowledged_by_user_id) : null,
    resolved_at: r.resolved_at != null ? String(r.resolved_at) : null,
    resolved_by_user_id: r.resolved_by_user_id != null ? String(r.resolved_by_user_id) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function mapExistingForMerge(
  r: Record<string, unknown>
): ExistingAlertEventRow & { idempotency_key: string } {
  return {
    idempotency_key: String(r.idempotency_key),
    status: String(r.status) as HliPhotoProtocolAlertEventStatus,
    first_detected_at: String(r.first_detected_at),
    last_detected_at: String(r.last_detected_at),
    acknowledged_at: r.acknowledged_at != null ? String(r.acknowledged_at) : null,
    acknowledged_by_user_id:
      r.acknowledged_by_user_id != null ? String(r.acknowledged_by_user_id) : null,
    resolved_at: r.resolved_at != null ? String(r.resolved_at) : null,
    resolved_by_user_id: r.resolved_by_user_id != null ? String(r.resolved_by_user_id) : null,
  };
}

export type UpsertPhotoProtocolAlertEventsResult = {
  tenant_id: string;
  computed_count: number;
  upserted: number;
  scan_note: string | null;
};

/**
 * Recomputes alerts from shared rules, then idempotently upserts into `hli_photo_protocol_alert_events`.
 */
export async function upsertPhotoProtocolAlertEventsForTenant(
  tenantId: string,
  filters: PhotoProtocolAnalyticsFilters = {},
  client?: SupabaseClient
): Promise<UpsertPhotoProtocolAlertEventsResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const ds = await loadPhotoProtocolDatasetForTenant(tid, filters, null, supabase);
  const scan_note =
    ds.sessions.length >= 5000
      ? "Session list capped at 5000 rows for this tenant window — narrow date range for full accuracy."
      : null;

  const alerts = buildPhotoProtocolAlerts({
    sessions: ds.sessions,
    sessionSlots: ds.sessionSlots,
    slotsByTemplateId: ds.slotsByTemplateId,
  });

  const sessionById = new Map(ds.sessions.map((s) => [s.id, s]));
  const runIso = new Date().toISOString();
  const candidates: PhotoProtocolAlertUpsertCandidate[] = [];

  for (const a of alerts) {
    const session = sessionById.get(a.session_id);
    if (!session) continue;
    const clinicId = session.patient_id
      ? (ds.patientPrimaryClinicByPatientId.get(session.patient_id) ?? null)
      : null;
    const base = mapComputedAlertToUpsertCandidate(a, session, clinicId, runIso);
    candidates.push(base);
  }

  if (candidates.length === 0) {
    return { tenant_id: tid, computed_count: 0, upserted: 0, scan_note };
  }

  const keys = [...new Set(candidates.map((c) => c.idempotency_key))];
  const existingByKey = new Map<string, ExistingAlertEventRow>();

  const chunk = 120;
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk);
    const { data, error } = await supabase
      .from("hli_photo_protocol_alert_events")
      .select(
        "idempotency_key, status, first_detected_at, last_detected_at, acknowledged_at, acknowledged_by_user_id, resolved_at, resolved_by_user_id"
      )
      .eq("tenant_id", tid)
      .in("idempotency_key", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const m = mapExistingForMerge(row as Record<string, unknown>);
      existingByKey.set(m.idempotency_key, m);
    }
  }

  const merged: PhotoProtocolAlertUpsertCandidate[] = candidates.map((c) =>
    mergePhotoProtocolAlertUpsertCandidate(c, existingByKey.get(c.idempotency_key), runIso)
  );

  let upserted = 0;
  for (let i = 0; i < merged.length; i += UPSERT_CHUNK) {
    const slice = merged.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("hli_photo_protocol_alert_events").upsert(slice, {
      onConflict: "idempotency_key",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(error.message);
    upserted += slice.length;
  }

  return { tenant_id: tid, computed_count: alerts.length, upserted, scan_note };
}

/**
 * Load persisted alert events for FoundationOS / operational review.
 */
export async function loadPhotoProtocolAlertEventsForTenant(
  tenantId: string,
  filters: PhotoProtocolAlertEventsFilters = {},
  client?: SupabaseClient
): Promise<{ tenant_id: string; events: HliPhotoProtocolAlertEvent[] }> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const limitRaw = filters.limit ?? 200;
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

  let q = supabase
    .from("hli_photo_protocol_alert_events")
    .select("*")
    .eq("tenant_id", tid)
    .order("last_detected_at", { ascending: false })
    .limit(limit);

  if (filters.source_system?.trim()) {
    q = q.eq("source_system", filters.source_system.trim());
  }
  const st = filters.alert_status?.trim();
  if (st && st !== "all") {
    q = q.eq("status", st);
  }
  if (filters.alert_event_type?.trim()) {
    q = q.eq("alert_type", filters.alert_event_type.trim());
  }
  if (filters.alert_severity?.trim()) {
    q = q.eq("severity", filters.alert_severity.trim());
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return {
    tenant_id: tid,
    events: (data ?? []).map((row) => mapAlertEventRow(row as Record<string, unknown>)),
  };
}

async function loadAlertEventRow(
  alertEventId: string,
  client: SupabaseClient
): Promise<HliPhotoProtocolAlertEvent | null> {
  const { data, error } = await client
    .from("hli_photo_protocol_alert_events")
    .select("*")
    .eq("id", alertEventId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapAlertEventRow(data as Record<string, unknown>);
}

export async function acknowledgePhotoProtocolAlertEvent(
  tenantId: string,
  alertEventId: string,
  actorFiUserId: string | null,
  client?: SupabaseClient
): Promise<HliPhotoProtocolAlertEvent> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const row = await loadAlertEventRow(alertEventId, supabase);
  if (!row || row.tenant_id !== tid) throw new Error("Alert event not found for tenant.");

  assertPhotoProtocolAlertStatusTransition(row.status, "acknowledged");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("hli_photo_protocol_alert_events")
    .update({
      status: "acknowledged",
      acknowledged_at: now,
      acknowledged_by_user_id: actorFiUserId,
    })
    .eq("id", row.id)
    .eq("tenant_id", tid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAlertEventRow(data as Record<string, unknown>);
}

export async function resolvePhotoProtocolAlertEvent(
  tenantId: string,
  alertEventId: string,
  actorFiUserId: string | null,
  client?: SupabaseClient
): Promise<HliPhotoProtocolAlertEvent> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const row = await loadAlertEventRow(alertEventId, supabase);
  if (!row || row.tenant_id !== tid) throw new Error("Alert event not found for tenant.");

  assertPhotoProtocolAlertStatusTransition(row.status, "resolved");
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "resolved",
    resolved_at: now,
    resolved_by_user_id: actorFiUserId,
  };
  if (!row.acknowledged_at) {
    patch.acknowledged_at = now;
    patch.acknowledged_by_user_id = actorFiUserId;
  }
  const { data, error } = await supabase
    .from("hli_photo_protocol_alert_events")
    .update(patch)
    .eq("id", row.id)
    .eq("tenant_id", tid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAlertEventRow(data as Record<string, unknown>);
}

export async function dismissPhotoProtocolAlertEvent(
  tenantId: string,
  alertEventId: string,
  actorFiUserId: string | null,
  client?: SupabaseClient
): Promise<HliPhotoProtocolAlertEvent> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const row = await loadAlertEventRow(alertEventId, supabase);
  if (!row || row.tenant_id !== tid) throw new Error("Alert event not found for tenant.");

  assertPhotoProtocolAlertStatusTransition(row.status, "dismissed");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("hli_photo_protocol_alert_events")
    .update({
      status: "dismissed",
      acknowledged_at: row.acknowledged_at ?? now,
      acknowledged_by_user_id: row.acknowledged_by_user_id ?? actorFiUserId,
    })
    .eq("id", row.id)
    .eq("tenant_id", tid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapAlertEventRow(data as Record<string, unknown>);
}
