import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sha256HexUtf8, stableStringifyForWebhookHash } from "@/src/lib/integrations/timely/timelyWebhookEvents.server";

/**
 * HubSpot timeline-sync audit, recorded in the shared fi_integration_webhook_events inbox with
 * provider='hubspot'. Mirrors the Timely audit's claim → handler → finalize lifecycle (and reuses
 * the same idempotency unique index on tenant_id+route+payload_hash) but is a separate module so
 * the Timely integration is not modified.
 */

export const HUBSPOT_TIMELINE_SOURCE = "hubspot.timeline_sync";

export const HUBSPOT_TIMELINE_ROUTES = {
  contact: "/api/tenants/[tenantId]/integrations/hubspot/contact",
  emailEvent: "/api/tenants/[tenantId]/integrations/hubspot/email-event",
  deal: "/api/tenants/[tenantId]/integrations/hubspot/deal",
} as const;

type WebhookEventStatus = "received" | "processed" | "error";

export function computeHubspotWebhookPayloadHash(payload: unknown): string {
  return sha256HexUtf8(stableStringifyForWebhookHash(payload));
}

async function finalizeSafe(
  supabase: SupabaseClient,
  eventId: string,
  status: Exclude<WebhookEventStatus, "received">,
  errorMessage: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from("fi_integration_webhook_events")
      .update({ status, error_message: errorMessage?.trim() || null })
      .eq("id", eventId);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(
      `[hubspot-timeline-audit] failed to finalize event ${eventId} as "${status}" (work already committed): ${msg}`
    );
  }
}

async function loadEventByHash(
  supabase: SupabaseClient,
  tenantId: string,
  route: string,
  payloadHash: string
): Promise<{ id: string; status: WebhookEventStatus } | null> {
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
  const row = data as { id: string; status: WebhookEventStatus };
  return { id: String(row.id), status: row.status };
}

export type WithHubspotTimelineAuditResult<T> =
  | { ok: true; value: T; event_id: string }
  | { ok: true; duplicate: true; event_id: string; duplicate_status: WebhookEventStatus }
  | { ok: false; message: string; status: number; event_id?: string };

/**
 * Claim the inbound webhook row (idempotent), run handler, mark processed/error.
 * - Duplicate already processed / still received → 200 no-op (handler not re-run).
 * - Duplicate previously errored → re-run handler against the existing row (repair).
 * - Handler success + finalize failure → still 200 (never a retry-triggering 500 after commit).
 */
export async function withHubspotTimelineAudit<T>(params: {
  tenantId: string;
  route: string;
  /** Specific kind for event_type, e.g. "contact" | "email_event" | "deal". */
  kind: string;
  payload: unknown;
  handler: () => Promise<{ ok: true; value: T } | { ok: false; message: string; status: number }>;
  supabase?: SupabaseClient;
}): Promise<WithHubspotTimelineAuditResult<T>> {
  const supabase = params.supabase ?? supabaseAdmin();
  const payload_hash = computeHubspotWebhookPayloadHash(params.payload);
  // The stored payload documents the timeline-sync source alongside the raw body.
  const auditPayload = { source: HUBSPOT_TIMELINE_SOURCE, kind: params.kind, body: params.payload };

  const row = {
    tenant_id: params.tenantId,
    provider: "hubspot" as const,
    event_type: `hubspot.${params.kind}`,
    route: params.route,
    status: "received" as WebhookEventStatus,
    payload: auditPayload as never,
    payload_hash,
    error_message: null as string | null,
  };

  const { data, error } = await supabase
    .from("fi_integration_webhook_events")
    .insert(row)
    .select("id")
    .single();

  let eventId: string;
  if (!error && data?.id) {
    eventId = String(data.id);
  } else if (error?.code === "23505") {
    const existing = await loadEventByHash(supabase, params.tenantId, params.route, payload_hash);
    if (!existing) {
      return { ok: false, message: error.message ?? "Failed to store webhook event.", status: 500 };
    }
    if (existing.status === "processed" || existing.status === "received") {
      return { ok: true, duplicate: true, event_id: existing.id, duplicate_status: existing.status };
    }
    eventId = existing.id; // prior error → re-run to repair
  } else {
    return { ok: false, message: error?.message ?? "Failed to store webhook event.", status: 500 };
  }

  try {
    const result = await params.handler();
    if (!result.ok) {
      await finalizeSafe(supabase, eventId, "error", result.message);
      return { ok: false, message: result.message, status: result.status, event_id: eventId };
    }
    await finalizeSafe(supabase, eventId, "processed", null);
    return { ok: true, value: result.value, event_id: eventId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    await finalizeSafe(supabase, eventId, "error", msg);
    return { ok: false, message: msg, status: 500, event_id: eventId };
  }
}
