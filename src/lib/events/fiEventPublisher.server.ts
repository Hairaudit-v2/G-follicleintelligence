import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import { getFiEventVersion, isFiEventName, type FiEventName } from "./fiEventRegistry";

export type PublishFiEventInput = {
  tenantId: string;
  eventName: string;
  sourceModule: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

export type PublishFiEventOptions = {
  supabaseClientForTests?: SupabaseClient;
  /** When true, validation and persistence errors propagate to the caller. */
  strict?: boolean;
};

export type PublishFiEventResult =
  | { ok: true; eventId: string; duplicate?: boolean }
  | { ok: false; error: string };

export class FiEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiEventValidationError";
  }
}

type SubscriberRow = {
  id: string;
  tenant_id: string | null;
  subscriber_key: string;
  source_module: string | null;
  event_name: string;
  target_module: string;
  handler_key: string;
  is_enabled: boolean;
  retry_limit: number;
};

function resolveClient(options?: PublishFiEventOptions): SupabaseClient {
  return options?.supabaseClientForTests ?? supabaseAdmin();
}

function assertJsonSafe(value: unknown, label: string): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new FiEventValidationError(`${label} must be a plain object.`);
  }
  try {
    JSON.stringify(value);
  } catch {
    throw new FiEventValidationError(`${label} must be JSON-serializable.`);
  }
  return value as Record<string, unknown>;
}

function subscriberMatchesEvent(
  subscriber: SubscriberRow,
  tenantId: string,
  eventName: string,
  sourceModule: string
): boolean {
  if (!subscriber.is_enabled) return false;
  if (subscriber.event_name !== eventName) return false;
  if (subscriber.tenant_id && subscriber.tenant_id !== tenantId) return false;
  if (subscriber.source_module && subscriber.source_module !== sourceModule) return false;
  return true;
}

async function loadMatchingSubscribers(
  supabase: SupabaseClient,
  tenantId: string,
  eventName: string,
  sourceModule: string
): Promise<SubscriberRow[]> {
  const { data, error } = await supabase
    .from("fi_platform_event_subscribers")
    .select(
      "id, tenant_id, subscriber_key, source_module, event_name, target_module, handler_key, is_enabled, retry_limit"
    )
    .eq("event_name", eventName)
    .eq("is_enabled", true);

  if (error) throw new Error(error.message);

  return ((data ?? []) as SubscriberRow[]).filter((row) =>
    subscriberMatchesEvent(row, tenantId, eventName, sourceModule)
  );
}

async function findIdempotentEvent(
  supabase: SupabaseClient,
  tenantId: string,
  eventName: string,
  idempotencyKey: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_platform_events")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("event_name", eventName)
    .eq("metadata->>idempotencyKey", idempotencyKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

/**
 * Validates, persists, and fans out FI platform events to registered subscribers.
 * Non-critical emission should use {@link publishFiEventBestEffort} or strict: false (default).
 */
export async function publishFiEvent(
  input: PublishFiEventInput,
  options: PublishFiEventOptions = {}
): Promise<PublishFiEventResult> {
  const strict = options.strict === true;

  try {
    const tenantId = input.tenantId?.trim();
    if (!tenantId) throw new FiEventValidationError("tenantId is required.");

    const eventNameRaw = input.eventName?.trim();
    if (!eventNameRaw || !isFiEventName(eventNameRaw)) {
      throw new FiEventValidationError(`Unknown or missing event name "${input.eventName ?? ""}".`);
    }
    const eventName = eventNameRaw as FiEventName;

    const sourceModule = input.sourceModule?.trim();
    if (!sourceModule) throw new FiEventValidationError("sourceModule is required.");

    const payload = assertJsonSafe(input.payload, "payload");
    const metadata = assertJsonSafe(input.metadata, "metadata");
    const idempotencyKey =
      typeof metadata.idempotencyKey === "string" ? metadata.idempotencyKey.trim() : "";

    const supabase = resolveClient(options);

    if (idempotencyKey) {
      const existingId = await findIdempotentEvent(supabase, tenantId, eventName, idempotencyKey);
      if (existingId) {
        return { ok: true, eventId: existingId, duplicate: true };
      }
    }

    const eventId = randomUUID();
    const now = new Date().toISOString();
    const occurredAt = input.occurredAt?.trim() || now;

    const { error: insertError } = await supabase.from("fi_platform_events").insert({
      id: eventId,
      tenant_id: tenantId,
      event_name: eventName,
      event_version: getFiEventVersion(eventName),
      source_module: sourceModule,
      entity_type: input.entityType?.trim() || null,
      entity_id: input.entityId?.trim() || null,
      actor_id: input.actorId?.trim() || null,
      correlation_id: input.correlationId?.trim() || null,
      causation_id: input.causationId?.trim() || null,
      occurred_at: occurredAt,
      payload,
      metadata,
      processing_status: "pending",
      failure_count: 0,
      created_at: now,
    });

    if (insertError) {
      if (insertError.code === "23505" && idempotencyKey) {
        const existingId = await findIdempotentEvent(supabase, tenantId, eventName, idempotencyKey);
        if (existingId) return { ok: true, eventId: existingId, duplicate: true };
      }
      throw new Error(insertError.message);
    }

    const subscribers = await loadMatchingSubscribers(supabase, tenantId, eventName, sourceModule);

    if (subscribers.length > 0) {
      const deliveryRows = subscribers.map((subscriber) => ({
        id: randomUUID(),
        tenant_id: tenantId,
        event_id: eventId,
        subscriber_id: subscriber.id,
        subscriber_key: subscriber.subscriber_key,
        target_module: subscriber.target_module,
        handler_key: subscriber.handler_key,
        status: "pending",
        attempt_count: 0,
        created_at: now,
        updated_at: now,
      }));

      const { error: deliveryError } = await supabase
        .from("fi_platform_event_deliveries")
        .insert(deliveryRows);

      if (deliveryError) throw new Error(deliveryError.message);
    } else {
      await supabase
        .from("fi_platform_events")
        .update({
          processing_status: "processed",
          processed_at: now,
        })
        .eq("id", eventId)
        .eq("tenant_id", tenantId);
    }

    logStructured("info", "fi_platform_event_published", {
      tenantId,
      eventId,
      eventName,
      sourceModule,
      subscriberCount: subscribers.length,
    });

    return { ok: true, eventId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    logStructured("warn", "fi_platform_event_publish_failed", {
      tenantId: input.tenantId,
      eventName: input.eventName,
      sourceModule: input.sourceModule,
      error: message,
    });
    if (strict) throw e;
    return { ok: false, error: message };
  }
}

/** Best-effort event emission — never throws; returns null on failure. */
export async function publishFiEventBestEffort(
  input: PublishFiEventInput,
  options: Omit<PublishFiEventOptions, "strict"> = {}
): Promise<string | null> {
  const result = await publishFiEvent(input, { ...options, strict: false });
  return result.ok ? result.eventId : null;
}
