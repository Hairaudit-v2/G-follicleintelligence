/**
 * Stage 13: strip all raw payload values before persistence — only structural metadata.
 */

import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core";

import type { InternalIntelligenceQueuedEnvelopeSummary } from "./internalBusQueue";
import type { InternalBusQueueIntelligenceEventLogLike } from "./internalBusObservability";

const SENSITIVE_KEY = new RegExp(
  [
    "email",
    "phone",
    "mobile",
    "name",
    "patient",
    "clinical",
    "photo",
    "image",
    "url",
    "uri",
    "path",
    "storage",
    "notes",
    "note",
    "address",
    "mrn",
    "dob",
    "birth",
    "diagnos",
    "free_?text",
    "comment",
    "description",
  ].join("|"),
  "i"
);

function isSafeKeyName(key: string): boolean {
  if (key.startsWith("_")) return false;
  return !SENSITIVE_KEY.test(key);
}

export type SanitizedIntelligencePersistenceShape = {
  /** Count of top-level payload keys considered non-sensitive (names only; no values). */
  key_count: number;
  /** Up to 12 non-sensitive top-level key names from the original payload (or queue summary). */
  key_sample: string[];
};

/**
 * From a raw envelope payload object: count and sample **key names** only; exclude sensitive key names.
 */
export function sanitizeIntelligencePayloadKeysForPersistence(
  payload: Record<string, unknown>
): SanitizedIntelligencePersistenceShape {
  const keys = Object.keys(payload).filter(isSafeKeyName);
  return {
    key_count: keys.length,
    key_sample: keys.slice(0, 12),
  };
}

export type SanitizeIntelligenceEventForPersistenceInput =
  | { kind: "envelope"; envelope: IntelligenceEventEnvelope }
  | { kind: "queue_summary"; summary: InternalIntelligenceQueuedEnvelopeSummary }
  | { kind: "log_like"; log: InternalBusQueueIntelligenceEventLogLike };

/**
 * Returns only safe metadata plus `payload_summary` for DB `payload_summary` jsonb.
 * Never includes raw payload values, paths, or clinical free text.
 */
export function sanitizeIntelligenceEventForPersistence(
  input: SanitizeIntelligenceEventForPersistenceInput
): {
  event_name: string;
  source: string;
  source_event_id: string | null;
  correlation_id: string | null;
  privacy_level: string;
  delivery_mode: string;
  occurred_at: string | null;
  payload_summary: Record<string, unknown>;
} {
  if (input.kind === "envelope") {
    const e = input.envelope;
    const shape = sanitizeIntelligencePayloadKeysForPersistence(
      e.payload as Record<string, unknown>
    );
    return {
      event_name: e.event_name,
      source: e.source,
      source_event_id: e.event_id ?? null,
      correlation_id: e.correlation_id ?? null,
      privacy_level: e.privacy_level,
      delivery_mode: e.delivery_mode,
      occurred_at: e.emitted_at,
      payload_summary: {
        key_count: shape.key_count,
        key_sample: shape.key_sample,
        schema_version: e.schema_version,
      },
    };
  }

  if (input.kind === "queue_summary") {
    const s = input.summary;
    const safeSample = s.payload_summary.top_level_keys_sample.filter(isSafeKeyName);
    const dropped = s.payload_summary.top_level_keys_sample.length - safeSample.length;
    const adjustedCount = Math.max(0, s.payload_summary.top_level_key_count - dropped);
    return {
      event_name: s.event_name,
      source: s.source,
      source_event_id: s.event_id ?? null,
      correlation_id: s.correlation_id ?? null,
      privacy_level: s.privacy_level,
      delivery_mode: s.delivery_mode,
      occurred_at: s.enqueued_at,
      payload_summary: {
        key_count: adjustedCount,
        key_sample: safeSample,
        queue_item_id: s.queue_item_id,
        schema_version: s.schema_version,
      },
    };
  }

  const log = input.log;
  return {
    event_name: String(log.event_name),
    source: String(log.source),
    source_event_id: null,
    correlation_id: log.correlation_id ?? null,
    privacy_level: String(log.privacy_level),
    delivery_mode: String(log.delivery_mode),
    occurred_at: log.occurred_at,
    payload_summary: {
      key_count: 0,
      key_sample: [],
      log_status: log.status,
    },
  };
}
