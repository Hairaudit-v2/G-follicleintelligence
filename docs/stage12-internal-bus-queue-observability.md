# Stage 12 — Internal bus in-memory queue and observability (dev/test only)

## Why a queued bus is needed

Synchronous `emitInternalIntelligenceEvent` couples producer latency to handler work and makes it harder to add back-pressure, retries, or ordered replay without touching FI ingest. A **queued internal bus** decouples “accept the envelope” from “run subscribers,” so future stages can drain safely under policy gates, attach tracing, and persist **sanitized** audit rows without blocking HTTP handlers.

## Queue modes (Stage 12)

| Mode | Description |
|------|-------------|
| **Disabled (default)** | `enqueueInternalIntelligenceEvent` returns `skipped_disabled`; no queue mutation. |
| **In-memory (Stage 12)** | When `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED === "1"` and `NODE_ENV !== "production"`, envelopes are stored in a process-local FIFO with **payload summaries** only in snapshots; handler-facing copies use a **sanitized** payload object (no raw clinical fields). |
| **Future persistent queue** | Not implemented — reserved for Stage 13+ additive tables and workers under governance. |

## Default disabled behavior

- **`FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED`** — must be exactly `"1"` to allow enqueue/drain (non-production only).
- **`FI_INTELLIGENCE_INTERNAL_BUS_OBSERVABILITY_ENABLED`** — must be `"1"` to opt into mapper-driven telemetry patterns in callers/tests; still **off** in production regardless of value.
- **`NODE_ENV === "production"`** — queue and observability gates force **off**; drain does not invoke handlers (`skipped_production` if drain is called while misconfigured).

No change to default FI HTTP ingest semantics: ingest still succeeds independently of bus/queue outcomes.

## Observability design

- Pure mapper helpers in `src/lib/fi/events/internalBusObservability.ts` turn enqueue/drain outcomes into **`IntelligenceEventLogRecord`-like** objects (`InternalBusQueueIntelligenceEventLogLike`): `event_name`, `source`, `correlation_id`, `privacy_level`, `delivery_mode`, `status`, optional `warnings`, optional `error_message`, `occurred_at`, `created_at`.
- **No database writes** in Stage 12 unless a pre-approved audit table already exists (none wired here). Prefer caller-held or test-local buffers.

## Privacy rules

- Queue **snapshots** and **handler replay envelopes** must not retain raw clinical payloads; Stage 12 stores key counts / key name samples only in summaries and replaces payload with a `_stage12_internal_queue` marker object for drain.
- Do not log full envelopes to stdout in production paths (shadow + queue remain production-inactive).
- Cross-system export and external dispatch remain policy-gated elsewhere (unchanged).

## Rollback plan

1. Unset `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED` and `FI_INTELLIGENCE_INTERNAL_BUS_OBSERVABILITY_ENABLED` (or set to anything other than `"1"`).
2. Shadow behavior automatically falls back to direct `emitInternalIntelligenceEvent(..., { mode: "inline_dev_only" })` when the queue flag is off.

No migrations to roll back.

## What remains disabled

- Production queue and production handler drain.
- External workers, DB-backed queues, and network dispatch.
- Policy-approved cross-system emit / export (Stage 10 defaults unchanged).

## Stage 13 recommendation

Design an **additive** persistent `intelligence_core_event_log` (name TBD) with strict payload sanitization columns, correlation keys, and replay pointers; keep writes **disabled** until governance signs off. Pair with a durable outbox or queue consumer that respects the same policy gates as HTTP ingest.
