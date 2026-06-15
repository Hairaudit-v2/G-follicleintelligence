# Stage 11 — Internal bus shadow event (dev/test only)

## Why this stage exists

Stage 10 introduced the internal intelligence bus, adapter mapping, and policy gates without changing production ingest behavior. Stage 11 **verifies the bus path end-to-end** using one low-risk, **shadow** event: no new HTTP event types, no schema migrations, no downstream calls, and **no production dispatch by default**.

## Chosen event

- **`hairaudit.audit.completed`** — already on the `@follicle/intelligence-core` allowlist (`INTELLIGENCE_EVENT_NAMES`).
- **Not** accepted on `POST /api/fi/events` today (`lib/fi/events/schema.ts` does not list it). The shadow envelope is **derived** after a successful HairAudit **`hairaudit.images.uploaded`** ingest (treated as the nearest FI-side “audit pipeline closed” hook).

## Where it is wired

- **`lib/fi/events/ingest.ts`** — after `handleHairAuditImagesUploaded` returns **`ok: true`**, calls `maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(envelope)` from `src/lib/fi/events/shadowHairAuditAuditCompletedBus.ts`.
- Adapter base: `toIntelligenceEventEnvelope` on the validated images envelope; shadow builder rewrites `event_name` to `hairaudit.audit.completed`.
- Emission: when `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED !== "1"`, `emitInternalIntelligenceEvent(..., { mode: "inline_dev_only" })` so **development** `NODE_ENV` still runs handlers when the shadow flag is on (the bus default for `development` is otherwise `noop`). When the Stage 12 queue flag is `"1"` (non-production), the shadow path **enqueues** instead; handlers run only after an explicit `drainInternalIntelligenceEventQueue` in dev/test tooling.

## Environment flags

| Variable | Meaning |
|----------|---------|
| `FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED` | Must be exactly `"1"` to allow shadow emission. |
| `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED` | Optional Stage 12: when `"1"` (and non-production), shadow uses the in-memory queue instead of direct emit. |
| `NODE_ENV` | If `"production"`, shadow emission is **forced off** regardless of the flag. |

Helper: `isInternalIntelligenceBusShadowEnabled()` in `src/lib/fi/events/internalBusEnv.ts`.

## Dev/test-only behavior

- Shadow emit runs only when the flag is `"1"` **and** `NODE_ENV !== "production"`.
- **No** bus payloads are persisted by this path; handlers (when registered in tests or local experiments) should stay in-memory only.
- Errors during emit or handler execution are **logged and swallowed**; HTTP ingest responses and handler results are unchanged.

## Rollback plan

1. Unset `FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED` (or set to anything other than `"1"`).
2. Optionally remove or no-op the post-handler call in `ingest.ts` in a follow-up commit.

No database rollback is required (no Stage 11 migrations).

## What remains disabled

- Cross-system export / graph policy gates (Stage 10 policy defaults unchanged).
- Queued/async bus delivery: Stage 12 adds an **opt-in in-memory** queue only; `queued_future` on the synchronous bus remains a no-op.
- Production bus handler execution by default (`resolveDefaultMode()` in `internalBus.ts` remains `noop` outside `NODE_ENV=test` unless callers pass `inline_dev_only`, which only the shadow helper does when the flag is on).

## Stage 12

See **`docs/stage12-internal-bus-queue-observability.md`** — in-memory queue, observability mappers, same production-off posture.
