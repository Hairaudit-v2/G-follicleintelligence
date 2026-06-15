/**
 * Stage 12: in-memory internal intelligence event queue (dev/test only, disabled by default).
 * Optional Stage 13: when `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED=1` (non-production), sanitized
 * lifecycle rows may be written to `fi_intelligence_event_logs` — failures never affect enqueue/drain.
 */

import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core";
import { invokeInternalIntelligenceHandlersInlineCapturingErrors } from "./internalBus";
import {
  isInternalIntelligenceInternalBusQueueEnabled,
  type InternalBusQueueEnvOptions,
} from "./internalBusQueueEnv";
import { isFiIntelligenceEventLogPersistEnabled } from "./persistentEventLogEnv";

const ADAPTER_MIRROR = "__fiAdapterRoundTrip" as const;

export type InternalIntelligenceQueuedEnvelopeSummary = {
  queue_item_id: string;
  enqueued_at: string;
  schema_version: number;
  emitted_at: string;
  source: IntelligenceEventEnvelope["source"];
  event_name: IntelligenceEventEnvelope["event_name"];
  delivery_mode: IntelligenceEventEnvelope["delivery_mode"];
  privacy_level: IntelligenceEventEnvelope["privacy_level"];
  correlation_id?: string;
  event_id?: string;
  /** Non-clinical descriptor of payload shape only (no image paths, filenames, or clinical values). */
  payload_summary: {
    top_level_key_count: number;
    top_level_keys_sample: string[];
  };
};

type QueueEntry = {
  summary: InternalIntelligenceQueuedEnvelopeSummary;
  /** Envelope passed to handlers on drain — payload is sanitized (no raw clinical blob). */
  envelope_for_handlers: IntelligenceEventEnvelope;
};

const queue: QueueEntry[] = [];

function newQueueItemId(): string {
  return `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildPayloadSummary(payload: Record<string, unknown>): InternalIntelligenceQueuedEnvelopeSummary["payload_summary"] {
  const keys = Object.keys(payload).filter((k) => k !== ADAPTER_MIRROR);
  const top_level_keys_sample = keys.slice(0, 12);
  return {
    top_level_key_count: keys.length,
    top_level_keys_sample,
  };
}

/**
 * Replace payload with a non-clinical summary object suitable for handler dev stubs
 * and queue snapshots (Stage 12 — avoid retaining PHI/PII in the queue).
 */
export function sanitizeIntelligenceEnvelopeForQueue(
  envelope: IntelligenceEventEnvelope
): IntelligenceEventEnvelope {
  const payload = envelope.payload as Record<string, unknown>;
  const summary = buildPayloadSummary(payload);
  return {
    ...envelope,
    payload: {
      _stage12_internal_queue: true,
      top_level_key_count: summary.top_level_key_count,
      top_level_keys_sample: summary.top_level_keys_sample,
    },
  };
}

export type EnqueueInternalIntelligenceEventOptions = InternalBusQueueEnvOptions;

export type EnqueueInternalIntelligenceEventResult =
  | { status: "skipped_disabled" }
  | { status: "enqueued"; queue_item_id: string; depth_after: number };

export async function enqueueInternalIntelligenceEvent(
  envelope: IntelligenceEventEnvelope,
  options?: EnqueueInternalIntelligenceEventOptions
): Promise<EnqueueInternalIntelligenceEventResult> {
  if (!isInternalIntelligenceInternalBusQueueEnabled(options)) {
    return { status: "skipped_disabled" };
  }

  const enqueued_at = new Date().toISOString();
  const queue_item_id = newQueueItemId();
  const payload = envelope.payload as Record<string, unknown>;
  const payload_summary = buildPayloadSummary(payload);

  const summary: InternalIntelligenceQueuedEnvelopeSummary = {
    queue_item_id,
    enqueued_at,
    schema_version: envelope.schema_version,
    emitted_at: envelope.emitted_at,
    source: envelope.source,
    event_name: envelope.event_name,
    delivery_mode: envelope.delivery_mode,
    privacy_level: envelope.privacy_level,
    ...(envelope.correlation_id ? { correlation_id: envelope.correlation_id } : {}),
    ...(envelope.event_id ? { event_id: envelope.event_id } : {}),
    payload_summary,
  };

  const envelope_for_handlers = sanitizeIntelligenceEnvelopeForQueue(envelope);

  queue.push({ summary, envelope_for_handlers });

  if (isFiIntelligenceEventLogPersistEnabled(options)) {
    try {
      const { persistIntelligenceEventLog } = await import("./persistIntelligenceEventLog.server");
      await persistIntelligenceEventLog(
        { status: "enqueued", summary, envelope_for_payload_shape: envelope },
        options
      );
    } catch {
      /* persistence must not affect enqueue */
    }
  }

  return { status: "enqueued", queue_item_id, depth_after: queue.length };
}

export type DrainInternalIntelligenceEventQueueOptions = InternalBusQueueEnvOptions;

export type DrainItemResult = {
  queue_item_id: string;
  event_name: IntelligenceEventEnvelope["event_name"];
  handler_errors: string[];
};

export type DrainInternalIntelligenceEventQueueResult =
  | { status: "skipped_disabled"; drained: 0 }
  | { status: "skipped_production"; drained: 0 }
  | { status: "drained"; drained: number; items: DrainItemResult[] };

/**
 * Drains the in-memory queue by invoking registered bus handlers with the sanitized
 * per-item envelope. Handler invocation never runs when `NODE_ENV === "production"`.
 * Handler failures are captured per item; nothing is thrown to the caller.
 */
export async function drainInternalIntelligenceEventQueue(
  options?: DrainInternalIntelligenceEventQueueOptions
): Promise<DrainInternalIntelligenceEventQueueResult> {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";

  if (nodeEnv === "production") {
    return { status: "skipped_production", drained: 0 };
  }

  if (env.FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED !== "1") {
    return { status: "skipped_disabled", drained: 0 };
  }

  const items: DrainItemResult[] = [];
  let drained = 0;

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    drained += 1;
    const { handler_errors } = await invokeInternalIntelligenceHandlersInlineCapturingErrors(
      next.envelope_for_handlers
    );
    items.push({
      queue_item_id: next.summary.queue_item_id,
      event_name: next.summary.event_name,
      handler_errors,
    });

    if (isFiIntelligenceEventLogPersistEnabled(options)) {
      try {
        const { persistIntelligenceEventLog } = await import("./persistIntelligenceEventLog.server");
        const errCount = handler_errors.length;
        await persistIntelligenceEventLog(
          {
            status: errCount ? "error" : "processed",
            summary: next.summary,
            payload_summary_extra: { handler_error_count: errCount },
            error_message: errCount ? `handler_errors:${errCount}` : null,
          },
          options
        );
      } catch {
        /* persistence must not affect drain */
      }
    }
  }

  return { status: "drained", drained, items };
}

export type InternalIntelligenceQueueSnapshot = {
  depth: number;
  items: ReadonlyArray<InternalIntelligenceQueuedEnvelopeSummary>;
};

export function getInternalIntelligenceQueueSnapshot(): InternalIntelligenceQueueSnapshot {
  return {
    depth: queue.length,
    items: queue.map((q) => ({ ...q.summary })),
  };
}

/** Test utility — clears queued items without touching bus handlers. */
export function __resetInternalIntelligenceEventQueueForTests(): void {
  queue.length = 0;
}
