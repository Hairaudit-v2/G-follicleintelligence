import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  extractTimelyDiscoveryEventType,
  sha256HexUtf8,
  stableStringifyForWebhookHash,
} from "./timelyWebhookEvents.server";

/** Supabase `jsonb` insert shape (matches PostgREST JSON). */
type WebhookPayloadJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: WebhookPayloadJson | undefined }
  | WebhookPayloadJson[];

export const TIMELY_WEBHOOK_ROUTES = {
  patient: "/api/tenants/[tenantId]/integrations/timely/patient",
  appointment: "/api/tenants/[tenantId]/integrations/timely/appointment",
  discovery: "/api/tenants/[tenantId]/integrations/timely/discovery",
} as const;

export type TimelyWebhookEventStatus = "received" | "processed" | "error";

export type InsertTimelyWebhookEventParams = {
  tenantId: string;
  route: string;
  payload: unknown;
  eventType?: string | null;
  status?: TimelyWebhookEventStatus;
  errorMessage?: string | null;
  supabase?: SupabaseClient;
};

export type InsertTimelyWebhookEventResult =
  | { ok: true; id: string; payload_hash: string }
  | { ok: false; message: string; status: number };

export function computeTimelyWebhookPayloadHash(payload: unknown): string {
  return sha256HexUtf8(stableStringifyForWebhookHash(payload));
}

export function resolveTimelyWebhookEventType(
  payload: unknown,
  fallback = "timely_webhook"
): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const explicit = extractTimelyDiscoveryEventType(payload);
    if (explicit !== "zapier_discovery") return explicit;
  }
  return fallback;
}

/** Persist inbound Timely webhook payload for audit (all routes). */
export async function insertTimelyWebhookEvent(
  params: InsertTimelyWebhookEventParams
): Promise<InsertTimelyWebhookEventResult> {
  const supabase = params.supabase ?? supabaseAdmin();
  const payload_hash = computeTimelyWebhookPayloadHash(params.payload);
  const event_type =
    params.eventType?.trim() ||
    resolveTimelyWebhookEventType(
      params.payload,
      params.route.includes("appointment") ? "timely.appointment" : "timely.webhook"
    );

  const row = {
    tenant_id: params.tenantId,
    provider: "timely" as const,
    event_type,
    route: params.route,
    status: (params.status ?? "received") as TimelyWebhookEventStatus,
    payload: params.payload as WebhookPayloadJson,
    payload_hash,
    error_message: params.errorMessage?.trim() || null,
  };

  const { data, error } = await supabase
    .from("fi_integration_webhook_events")
    .insert(row)
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Failed to store webhook event.", status: 500 };
  }
  return { ok: true, id: data.id, payload_hash };
}

export async function finalizeTimelyWebhookEvent(
  eventId: string,
  status: Exclude<TimelyWebhookEventStatus, "received">,
  errorMessage?: string | null,
  supabase?: SupabaseClient
): Promise<void> {
  const sb = supabase ?? supabaseAdmin();
  const { error } = await sb
    .from("fi_integration_webhook_events")
    .update({
      status,
      error_message: errorMessage?.trim() || null,
    })
    .eq("id", eventId.trim());
  if (error) throw new Error(error.message);
}

/**
 * Finalize the audit row without ever throwing.
 *
 * Audit finalization runs AFTER the business handler has already committed. If it fails we must
 * not surface a 500, because that would make Zapier retry work that already succeeded (a duplicate
 * write). We log and swallow instead.
 */
async function finalizeTimelyWebhookEventSafe(
  eventId: string,
  status: Exclude<TimelyWebhookEventStatus, "received">,
  errorMessage: string | null,
  supabase: SupabaseClient
): Promise<void> {
  try {
    await finalizeTimelyWebhookEvent(eventId, status, errorMessage, supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(
      `[timely-webhook-audit] failed to finalize event ${eventId} as "${status}" (business work already committed): ${msg}`
    );
  }
}

type ExistingWebhookEvent = { id: string; status: TimelyWebhookEventStatus };

async function loadWebhookEventByHash(
  supabase: SupabaseClient,
  tenantId: string,
  route: string,
  payloadHash: string
): Promise<ExistingWebhookEvent | null> {
  const { data, error } = await supabase
    .from("fi_integration_webhook_events")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("route", route)
    .eq("payload_hash", payloadHash)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ExistingWebhookEvent;
  return { id: String(row.id), status: row.status };
}

export type ClaimTimelyWebhookEventResult =
  | { ok: true; outcome: "claimed"; id: string; payload_hash: string }
  | {
      ok: true;
      outcome: "duplicate";
      id: string;
      payload_hash: string;
      status: TimelyWebhookEventStatus;
    }
  | { ok: false; message: string; status: number };

/**
 * Insert (claim) the inbound webhook row before processing. The unique idempotency index
 * (tenant_id, route, payload_hash) makes this the concurrency gate: the first delivery claims the
 * row; a duplicate/parallel/replayed delivery hits a unique violation (23505) and we report the
 * already-existing row instead.
 */
export async function claimTimelyWebhookEvent(
  params: InsertTimelyWebhookEventParams
): Promise<ClaimTimelyWebhookEventResult> {
  const supabase = params.supabase ?? supabaseAdmin();
  const payload_hash = computeTimelyWebhookPayloadHash(params.payload);
  const event_type =
    params.eventType?.trim() ||
    resolveTimelyWebhookEventType(
      params.payload,
      params.route.includes("appointment") ? "timely.appointment" : "timely.webhook"
    );

  const row = {
    tenant_id: params.tenantId,
    provider: "timely" as const,
    event_type,
    route: params.route,
    status: (params.status ?? "received") as TimelyWebhookEventStatus,
    payload: params.payload as WebhookPayloadJson,
    payload_hash,
    error_message: params.errorMessage?.trim() || null,
  };

  const { data, error } = await supabase
    .from("fi_integration_webhook_events")
    .insert(row)
    .select("id")
    .single();

  if (!error && data?.id) {
    return { ok: true, outcome: "claimed", id: String(data.id), payload_hash };
  }

  // Unique idempotency violation → a row for this (tenant, route, payload_hash) already exists.
  if (error?.code === "23505") {
    const existing = await loadWebhookEventByHash(
      supabase,
      params.tenantId,
      params.route,
      payload_hash
    );
    if (existing) {
      return {
        ok: true,
        outcome: "duplicate",
        id: existing.id,
        payload_hash,
        status: existing.status,
      };
    }
  }

  return { ok: false, message: error?.message ?? "Failed to store webhook event.", status: 500 };
}

export type WithTimelyWebhookAuditResult<T> =
  | { ok: true; value: T; event_id: string }
  | { ok: true; duplicate: true; event_id: string; duplicate_status: TimelyWebhookEventStatus }
  | { ok: false; message: string; status: number; event_id?: string };

/**
 * Claim the inbound webhook row (idempotent), run handler, mark processed or error.
 *
 * Idempotency / retry safety:
 * - A duplicate that already `processed` returns a 200 no-op (handler does NOT re-run).
 * - A duplicate still `received` (parallel in-flight delivery) returns a 200 no-op.
 * - A duplicate that previously `error`ed re-runs the handler against the existing row (repair).
 * - If the handler succeeds but audit finalization fails, we still return 200 — never a retry-
 *   triggering 500 for work that already committed.
 */
export async function withTimelyWebhookAudit<T>(params: {
  tenantId: string;
  route: string;
  payload: unknown;
  eventType?: string | null;
  handler: () => Promise<{ ok: true; value: T } | { ok: false; message: string; status: number }>;
  supabase?: SupabaseClient;
}): Promise<WithTimelyWebhookAuditResult<T>> {
  const supabase = params.supabase ?? supabaseAdmin();

  const claim = await claimTimelyWebhookEvent({
    tenantId: params.tenantId,
    route: params.route,
    payload: params.payload,
    eventType: params.eventType,
    status: "received",
    supabase,
  });

  if (!claim.ok) {
    return { ok: false, message: claim.message, status: claim.status };
  }

  // Duplicate that already succeeded or is still in-flight: short-circuit so Zapier does not retry
  // into a duplicate booking/consultation/CRM write.
  if (
    claim.outcome === "duplicate" &&
    (claim.status === "processed" || claim.status === "received")
  ) {
    return { ok: true, duplicate: true, event_id: claim.id, duplicate_status: claim.status };
  }

  // Either a freshly claimed row, or a prior `error` row we re-run to repair.
  const eventId = claim.id;

  try {
    const result = await params.handler();
    if (!result.ok) {
      await finalizeTimelyWebhookEventSafe(eventId, "error", result.message, supabase);
      return { ok: false, message: result.message, status: result.status, event_id: eventId };
    }
    await finalizeTimelyWebhookEventSafe(eventId, "processed", null, supabase);
    return { ok: true, value: result.value, event_id: eventId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    await finalizeTimelyWebhookEventSafe(eventId, "error", msg, supabase);
    return { ok: false, message: msg, status: 500, event_id: eventId };
  }
}
