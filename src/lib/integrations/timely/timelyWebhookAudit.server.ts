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

export function resolveTimelyWebhookEventType(payload: unknown, fallback = "timely_webhook"): string {
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
    resolveTimelyWebhookEventType(params.payload, params.route.includes("appointment") ? "timely.appointment" : "timely.webhook");

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

  const { data, error } = await supabase.from("fi_integration_webhook_events").insert(row).select("id").single();

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

export type WithTimelyWebhookAuditResult<T> =
  | { ok: true; value: T; event_id: string }
  | { ok: false; message: string; status: number; event_id?: string };

/** Insert received row, run handler, mark processed or error. */
export async function withTimelyWebhookAudit<T>(params: {
  tenantId: string;
  route: string;
  payload: unknown;
  eventType?: string | null;
  handler: () => Promise<{ ok: true; value: T } | { ok: false; message: string; status: number }>;
  supabase?: SupabaseClient;
}): Promise<WithTimelyWebhookAuditResult<T>> {
  const supabase = params.supabase ?? supabaseAdmin();

  const inserted = await insertTimelyWebhookEvent({
    tenantId: params.tenantId,
    route: params.route,
    payload: params.payload,
    eventType: params.eventType,
    status: "received",
    supabase,
  });

  if (!inserted.ok) {
    return { ok: false, message: inserted.message, status: inserted.status };
  }

  try {
    const result = await params.handler();
    if (!result.ok) {
      await finalizeTimelyWebhookEvent(inserted.id, "error", result.message, supabase);
      return { ok: false, message: result.message, status: result.status, event_id: inserted.id };
    }
    await finalizeTimelyWebhookEvent(inserted.id, "processed", null, supabase);
    return { ok: true, value: result.value, event_id: inserted.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error.";
    await finalizeTimelyWebhookEvent(inserted.id, "error", msg, supabase);
    return { ok: false, message: msg, status: 500, event_id: inserted.id };
  }
}
