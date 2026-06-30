import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import { dispatchFiEventHandler } from "./fiEventHandlers.server";
import type { FiEventDeliveryStatus, FiEventProcessingStatus } from "./fiEventRegistry";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  nowMs?: number;
  limit?: number;
};

type EventRow = {
  id: string;
  tenant_id: string;
  event_name: string;
  source_module: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  processing_status: FiEventProcessingStatus;
};

type DeliveryRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  subscriber_id: string | null;
  subscriber_key: string;
  target_module: string;
  handler_key: string;
  status: FiEventDeliveryStatus;
  attempt_count: number;
  next_attempt_at: string | null;
};

type SubscriberRetryRow = {
  retry_limit: number;
};

const DELIVERY_SELECT =
  "id, tenant_id, event_id, subscriber_id, subscriber_key, target_module, handler_key, status, attempt_count, next_attempt_at";

const EVENT_SELECT =
  "id, tenant_id, event_name, source_module, payload, metadata, processing_status";

function resolveClient(opts: ServerOpts): SupabaseClient {
  return opts.supabaseClientForTests ?? supabaseAdmin();
}

export function computeFiEventRetryDelayMs(attemptCount: number): number {
  const baseMs = 30_000;
  const maxMs = 3_600_000;
  const delay = baseMs * 2 ** Math.max(0, attemptCount - 1);
  return Math.min(delay, maxMs);
}

async function loadSubscriberRetryLimit(
  supabase: SupabaseClient,
  subscriberId: string | null,
  _handlerKey: string
): Promise<number> {
  if (!subscriberId) return 3;

  const { data, error } = await supabase
    .from("fi_platform_event_subscribers")
    .select("retry_limit")
    .eq("id", subscriberId)
    .maybeSingle();

  if (error || !data) return 3;
  return (data as SubscriberRetryRow).retry_limit ?? 3;
}

async function loadEventForDelivery(
  supabase: SupabaseClient,
  eventId: string,
  tenantId: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("fi_platform_events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

async function refreshEventProcessingStatus(
  supabase: SupabaseClient,
  eventId: string,
  tenantId: string,
  nowIso: string
): Promise<void> {
  const { data: deliveries, error } = await supabase
    .from("fi_platform_event_deliveries")
    .select("status")
    .eq("event_id", eventId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  const rows = (deliveries ?? []) as { status: FiEventDeliveryStatus }[];

  if (rows.length === 0) {
    await supabase
      .from("fi_platform_events")
      .update({ processing_status: "processed", processed_at: nowIso })
      .eq("id", eventId)
      .eq("tenant_id", tenantId);
    return;
  }

  const allTerminal = rows.every((row) => row.status === "delivered" || row.status === "skipped");
  const anyFailedExhausted = rows.some((row) => row.status === "failed");
  const anyPending = rows.some((row) => row.status === "pending" || row.status === "processing");

  let processingStatus: FiEventProcessingStatus = "processing";
  if (allTerminal) processingStatus = "processed";
  else if (anyFailedExhausted && !anyPending) processingStatus = "failed";

  await supabase
    .from("fi_platform_events")
    .update({
      processing_status: processingStatus,
      processed_at: allTerminal ? nowIso : null,
      failure_count: anyFailedExhausted ? 1 : 0,
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);
}

async function processOneDelivery(
  delivery: DeliveryRow,
  event: EventRow,
  opts: ServerOpts
): Promise<void> {
  const supabase = resolveClient(opts);
  const nowMs = opts.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  await supabase
    .from("fi_platform_event_deliveries")
    .update({ status: "processing", updated_at: nowIso })
    .eq("id", delivery.id)
    .eq("tenant_id", delivery.tenant_id);

  const handlerResult = await dispatchFiEventHandler(
    {
      tenantId: delivery.tenant_id,
      handlerKey: delivery.handler_key,
      targetModule: delivery.target_module,
      event: {
        id: event.id,
        eventName: event.event_name,
        sourceModule: event.source_module,
        payload: event.payload ?? {},
        metadata: event.metadata ?? {},
      },
    },
    opts
  );

  const retryLimit = await loadSubscriberRetryLimit(
    supabase,
    delivery.subscriber_id,
    delivery.handler_key
  );
  const nextAttemptCount = delivery.attempt_count + 1;

  if (handlerResult.ok) {
    await supabase
      .from("fi_platform_event_deliveries")
      .update({
        status: handlerResult.skipped ? "skipped" : "delivered",
        attempt_count: nextAttemptCount,
        delivered_at: nowIso,
        last_error: null,
        next_attempt_at: null,
        updated_at: nowIso,
      })
      .eq("id", delivery.id)
      .eq("tenant_id", delivery.tenant_id);
    return;
  }

  const exhausted = nextAttemptCount >= retryLimit;
  const nextAttemptAt = exhausted
    ? null
    : new Date(nowMs + computeFiEventRetryDelayMs(nextAttemptCount)).toISOString();

  await supabase
    .from("fi_platform_event_deliveries")
    .update({
      status: exhausted ? "failed" : "pending",
      attempt_count: nextAttemptCount,
      last_error: handlerResult.error?.slice(0, 1000) ?? "handler_failed",
      next_attempt_at: nextAttemptAt,
      updated_at: nowIso,
    })
    .eq("id", delivery.id)
    .eq("tenant_id", delivery.tenant_id);

  logStructured("warn", "fi_platform_event_delivery_failed", {
    tenantId: delivery.tenant_id,
    eventId: delivery.event_id,
    deliveryId: delivery.id,
    handlerKey: delivery.handler_key,
    attemptCount: nextAttemptCount,
    exhausted,
    error: handlerResult.error,
  });
}

async function loadPendingDeliveries(
  supabase: SupabaseClient,
  limit: number,
  nowIso: string,
  includeFailedRetry: boolean
): Promise<DeliveryRow[]> {
  const query = supabase
    .from("fi_platform_event_deliveries")
    .select(DELIVERY_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  const { data: pending, error: pendingError } = await query;
  if (pendingError) throw new Error(pendingError.message);

  const rows = [...((pending ?? []) as DeliveryRow[])];

  if (includeFailedRetry) {
    const { data: retryRows, error: retryError } = await supabase
      .from("fi_platform_event_deliveries")
      .select(DELIVERY_SELECT)
      .eq("status", "failed")
      .lte("next_attempt_at", nowIso)
      .order("next_attempt_at", { ascending: true })
      .limit(limit);

    if (retryError) throw new Error(retryError.message);
    rows.push(...((retryRows ?? []) as DeliveryRow[]));
  }

  return rows.slice(0, limit);
}

/** Mark pending platform events as processing when they have outstanding deliveries. */
export async function processPendingFiEvents(
  opts: ServerOpts = {}
): Promise<{ processed: number }> {
  const supabase = resolveClient(opts);
  const limit = opts.limit ?? 50;

  const { data, error } = await supabase
    .from("fi_platform_events")
    .select("id, tenant_id")
    .eq("processing_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { id: string; tenant_id: string }[];

  for (const row of rows) {
    const { count } = await supabase
      .from("fi_platform_event_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", row.id);

    if ((count ?? 0) > 0) {
      await supabase
        .from("fi_platform_events")
        .update({ processing_status: "processing" })
        .eq("id", row.id)
        .eq("tenant_id", row.tenant_id);
    }
  }

  return { processed: rows.length };
}

/** Process pending event deliveries and update parent event status. */
export async function processFiEventDeliveries(
  opts: ServerOpts = {}
): Promise<{ delivered: number; failed: number }> {
  const supabase = resolveClient(opts);
  const limit = opts.limit ?? 50;
  const nowMs = opts.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const deliveries = await loadPendingDeliveries(supabase, limit, nowIso, false);
  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    if (delivery.next_attempt_at && Date.parse(delivery.next_attempt_at) > nowMs) {
      continue;
    }

    const event = await loadEventForDelivery(supabase, delivery.event_id, delivery.tenant_id);
    if (!event) continue;

    await processOneDelivery(delivery, event, opts);
    await refreshEventProcessingStatus(supabase, delivery.event_id, delivery.tenant_id, nowIso);

    const { data: updated } = await supabase
      .from("fi_platform_event_deliveries")
      .select("status")
      .eq("id", delivery.id)
      .maybeSingle();

    const status = (updated as { status: FiEventDeliveryStatus } | null)?.status;
    if (status === "delivered" || status === "skipped") delivered += 1;
    else if (status === "failed") failed += 1;
  }

  return { delivered, failed };
}

/** Retry failed deliveries whose next_attempt_at has elapsed. */
export async function retryFailedFiEventDeliveries(
  opts: ServerOpts = {}
): Promise<{ retried: number; delivered: number; failed: number }> {
  const supabase = resolveClient(opts);
  const limit = opts.limit ?? 50;
  const nowMs = opts.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data, error } = await supabase
    .from("fi_platform_event_deliveries")
    .select(DELIVERY_SELECT)
    .eq("status", "failed")
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const deliveries = (data ?? []) as DeliveryRow[];
  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    await supabase
      .from("fi_platform_event_deliveries")
      .update({ status: "pending", updated_at: nowIso })
      .eq("id", delivery.id)
      .eq("tenant_id", delivery.tenant_id);

    const event = await loadEventForDelivery(supabase, delivery.event_id, delivery.tenant_id);
    if (!event) continue;

    await processOneDelivery({ ...delivery, status: "pending" }, event, opts);
    await refreshEventProcessingStatus(supabase, delivery.event_id, delivery.tenant_id, nowIso);

    const { data: updated } = await supabase
      .from("fi_platform_event_deliveries")
      .select("status")
      .eq("id", delivery.id)
      .maybeSingle();

    const status = (updated as { status: FiEventDeliveryStatus } | null)?.status;
    if (status === "delivered" || status === "skipped") delivered += 1;
    else if (status === "failed") failed += 1;
  }

  return { retried: deliveries.length, delivered, failed };
}
