# Stage 13 — Persistent intelligence event log (additive, policy-gated)

## Purpose

Provide an **append-only** database table for cross-system intelligence bus lifecycle metadata (`enqueued`, `processed`, `error`, and future statuses) so operators can **audit**, **replay planning**, and **correlate** internal intelligence traffic **without** retaining raw clinical payloads or changing FI HTTP ingest semantics.

## Table design

Table: `public.fi_intelligence_event_logs`

| Column | Role |
|--------|------|
| `id` | UUID primary key |
| `event_name`, `source` | Routing / filtering |
| `source_event_id` | Optional upstream id (e.g. envelope `event_id`) |
| `correlation_id` | Optional join key |
| `privacy_level`, `delivery_mode` | Policy metadata |
| `status` | Lifecycle (`enqueued`, `processed`, `error`, …) |
| `payload_summary` | JSONB: **sanitized** shape descriptors only (`key_count`, `key_sample`, optional queue linkage counts) |
| `warnings` | `text[]` of non-sensitive warning tokens |
| `error_message` | Optional **non-PHI** summary (handler failures use cardinality-only messages; see app sanitizer) |
| `occurred_at` | Business time when known |
| `created_at` | Insert time |

Indexes (see migration): `(event_name, created_at desc)`, `(source, created_at desc)`, partial `(correlation_id)`, `(status, created_at desc)`, `(privacy_level)`.

## Privacy rules

- **Never** store raw envelope `payload` values, filenames, storage paths, clinical narrative, names, emails, phone numbers, or photo URLs.
- `payload_summary` is restricted to structural hints: safe top-level key names and counts produced by `sanitizeIntelligenceEventForPersistence`.
- `error_message` must not echo untrusted free text from payloads; handler error strings are not copied verbatim when persistence is enabled (aggregate message only).
- RLS is **enabled** with **no** `authenticated` policies initially; only **service role** is granted `SELECT`/`INSERT` so reads/writes go through trusted server code after app-level gates.

## What is stored vs not stored

| Stored | Not stored |
|--------|------------|
| Event name, source, ids, correlation id, privacy/delivery modes, status, timestamps | Raw `IntelligenceEventEnvelope.payload` values |
| `payload_summary.key_count`, `payload_summary.key_sample` (allow-listed key names only) | Clinical measurements, notes, images, paths |
| Optional queue metadata (`queue_item_id`, handler error **count**) | PHI/PII strings from handlers |

## Environment flags

| Variable | Meaning |
|----------|---------|
| `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED` | Must be exactly `"1"` for **effective** persistence (see below). |

Helper: `src/lib/fi/events/persistentEventLogEnv.ts`.

## Disabled-by-default behavior

- Persistence is **off** unless `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED === "1"`.
- **`NODE_ENV === "production"`** — persistence is **forced off** in application code regardless of the flag (Stage 13 contract mirrors Stage 12 safety posture). There is **no** production opt-in until a future explicit policy stage documents an additional gate (for example paired review and `FI_INTELLIGENCE_POLICY_DEV` or similar).
- Unit tests may pass `env` / `nodeEnv` overrides into helpers and queue/persist call sites.

## Replay strategy (forward)

1. **Read path**: query `fi_intelligence_event_logs` by `event_name`, `source`, `status`, `created_at` windows using sanitized rows only.
2. **Replay**: reconstruct **synthetic** envelope stubs (metadata + empty or fixture payload) for dry-run consumers; compare counts and correlation keys against `fi_events` where applicable.
3. **No downstream dispatch** until a future policy-approved replay executor exists.

## Rollback / disable plan

1. Unset `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED` (or set to anything other than `"1"`): application stops inserting; queue and ingest behavior unchanged.
2. Optional: `supabase migration repair` / revert migration in a new migration that `drop table if exists public.fi_intelligence_event_logs` only if the table was never used in production (coordinate with DBA).
3. No change to Stage 12 in-memory queue semantics when persistence is off.

## Governance (Stage 16)

Before any **production** opt-in for this table’s inserts, complete the **production governance pack**: [`docs/governance/README.md`](./governance/README.md) (retention, legal/privacy, activation checklists). **Production intelligence event log persistence remains disabled** in application code until that sign-off **and** any future explicit policy + code stage — see [disabled-by-default behavior](#disabled-by-default-behavior) above.

---

## Stage 14 recommendation

Build **replay tooling** for `fi_intelligence_event_logs`:

- Dry-run replay filters by `event_name` / `source` / `status`.
- Diff summaries against `fi_events` (counts, correlation coverage).
- Still **no** downstream dispatch until explicit policy approval and a gated executor.
