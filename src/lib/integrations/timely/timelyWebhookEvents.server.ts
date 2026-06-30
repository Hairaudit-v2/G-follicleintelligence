import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { FiIntegrationWebhookEventRow } from "./timelyWebhookEvents.types";

/** Supabase `jsonb` insert shape (matches PostgREST JSON). */
type WebhookPayloadJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: WebhookPayloadJson | undefined }
  | WebhookPayloadJson[];

const DISCOVERY_ROUTE = "/api/tenants/[tenantId]/integrations/timely/discovery";

/** Stable JSON string for hashing (sorted object keys; arrays preserve order). */
export function stableStringifyForWebhookHash(value: unknown): string {
  if (value === undefined) {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringifyForWebhookHash(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringifyForWebhookHash(obj[k])}`);
  return `{${parts.join(",")}}`;
}

export function sha256HexUtf8(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function extractTimelyDiscoveryEventType(payload: unknown): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    for (const key of ["event_type", "event", "type"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "zapier_discovery";
}

export type InsertTimelyDiscoveryWebhookEventResult =
  | { ok: true; id: string }
  | { ok: false; message: string; status: number };

export async function insertTimelyZapierDiscoveryWebhookEvent(params: {
  tenantId: string;
  payload: unknown;
  supabase?: SupabaseClient;
}): Promise<InsertTimelyDiscoveryWebhookEventResult> {
  const supabase = params.supabase ?? supabaseAdmin();
  const canonical = stableStringifyForWebhookHash(params.payload);
  const payload_hash = sha256HexUtf8(canonical);
  const event_type = extractTimelyDiscoveryEventType(params.payload);

  const row = {
    tenant_id: params.tenantId,
    provider: "timely" as const,
    event_type,
    route: DISCOVERY_ROUTE,
    status: "received" as const,
    payload: params.payload as WebhookPayloadJson,
    payload_hash,
    error_message: null as string | null,
  };

  const { data, error } = await supabase
    .from("fi_integration_webhook_events")
    .insert(row)
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Failed to store webhook event.", status: 500 };
  }
  return { ok: true, id: data.id };
}

export async function loadRecentTimelyIntegrationWebhookEvents(
  tenantId: string,
  limit = 20,
  supabase?: SupabaseClient
): Promise<FiIntegrationWebhookEventRow[]> {
  const sb = supabase ?? supabaseAdmin();
  const { data, error } = await sb
    .from("fi_integration_webhook_events")
    .select(
      "id, tenant_id, provider, event_type, route, status, payload, payload_hash, error_message, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("provider", "timely")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as FiIntegrationWebhookEventRow[];
}

export type { FiIntegrationWebhookEventRow } from "./timelyWebhookEvents.types";
