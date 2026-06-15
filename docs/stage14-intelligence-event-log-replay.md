# Stage 14 — Intelligence event log replay (safe tooling)

## Purpose

Stage 14 adds **read-first replay tooling** for `public.fi_intelligence_event_logs` so operators can:

- Inspect which persisted intelligence rows match filters.
- **Dry-run** replay (no queue writes, no handler dispatch, no downstream calls).
- **Validate** that persisted metadata can still be mapped into a minimal strict `IntelligenceEventEnvelope` shape (warnings only — no throws by default).
- Optionally **enqueue shadow** copies into the Stage 12 **in-memory** internal bus queue for dev/test — still **without** calling legacy FI ingest, without downstream systems, and **without** writing new intelligence log rows from replay (`skipIntelligenceEventLogPersist` on enqueue).

This stage **does not** change producer ingest, handler implementations, or production dispatch policy.

## Dry-run default

- The CLI defaults to `--mode dry_run` (load + summary counts only).
- The admin system page surfaces a **server-side dry-run** summary on load (no replay button).

## Filters

Replay candidate loading supports (all optional):

| Filter | Field |
|--------|--------|
| `event_name` | `fi_intelligence_event_logs.event_name` |
| `source` | `fi_intelligence_event_logs.source` |
| `status` | `fi_intelligence_event_logs.status` |
| `privacy_level` | `fi_intelligence_event_logs.privacy_level` |
| `since` / `until` | `created_at` range (ISO-8601) |
| `correlation_id` | `correlation_id` exact match |
| `limit` | clamped **1–500** (default **50** in loader) |
| `order` | `newest_first` (default) or `oldest_first` on `created_at` |

Returned rows are **sanitized persisted shapes only** — no raw clinical payload reconstruction.

## Replay safety rules

1. **No downstream systems** and **no new network integrations** beyond existing Supabase service-role reads (same posture as other internal admin loaders).
2. **Never** invoke legacy FI event handlers or intelligence ingest paths from replay code.
3. **`enqueue_shadow`** is allowed only when:
   - `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED=1`, and
   - `NODE_ENV !== "production"`.
4. Replay enqueue sets **`skipIntelligenceEventLogPersist`** so replay does **not** append new `fi_intelligence_event_logs` rows unless a future stage explicitly changes that contract.
5. **Production dispatch** remains off: queue + drain policies from Stage 12/13 are unchanged.

## Comparison with `fi_events`

`compareIntelligenceEventLogsToFiEvents` is **read-only** and selects **metadata columns only** from `fi_events` (never `payload_json`). It summarizes:

- Name alignment gaps (`event_name` on intelligence logs vs `event_type` on `fi_events`) within the sampled windows.
- Counts by `event_name` / `source` / `status` (intelligence) vs `event_type` / `source_system` / `status` (`fi_events`).
- Optional linkage hint: `source_event_id` on intelligence logs vs `fi_events.id` (UUID match only — no payload reads).

**Contract:** `fi_events` uses `source_system`; intelligence logs use `source`. Correlation strings from producer payloads are **not** extracted here (`fi_events` has no `correlation_id` column).

## What replay does **not** do

- Does not mutate `fi_events` or intelligence log rows.
- Does not rehydrate original clinical payloads from summaries.
- Does not enable automatic production dispatch or external webhooks.
- Does not drain the internal queue (drain remains a separate explicit operation in Stage 12 tooling).

## Rollback / disable plan

- **CLI:** stop running the script; no persistent replay state is stored by Stage 14.
- **Shadow enqueue:** unset `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED` or run with `NODE_ENV=production` (queue hard-off).
- **Code removal:** delete Stage 14 modules + script; admin page section; tests — no DB migration dependency for replay itself.

## Stage 15 recommendation (governed dispatch)

Introduce **explicit governance** before any durable replay or production-adjacent dispatch:

1. **Policy approval state** — e.g. per-environment or per-run approval token stored durably.
2. **Allow-listed `event_name`s** for any non–dry-run path.
3. **Durable replay run records** — append-only table or object store for who/when/what filter/mode.
4. **Admin approval workflow** — human-in-the-loop for modes beyond `dry_run` / `validate_only`.
5. **Still no automatic production dispatch** until a dedicated production policy stage explicitly enables it.

---

See also: [Stage 13 — persistent intelligence event log](./stage13-persistent-intelligence-event-log.md), [Stage 12 — internal bus queue observability](./stage12-internal-bus-queue-observability.md).
