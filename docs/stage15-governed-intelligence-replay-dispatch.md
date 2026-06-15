# Stage 15 — Governed intelligence replay and dispatch planning

## Purpose

Stage 15 introduces **approval-gated replay planning** with **durable replay run records** stored in `public.fi_intelligence_replay_runs`. Operators can draft filtered replay plans, submit them for approval, and execute **only** the already-safe Stage 14 modes (`dry_run`, `validate_only`, `enqueue_shadow`) after explicit approval — **without** changing FI ingest behavior, **without** calling downstream systems, **without** production network integrations beyond existing Supabase service-role access, **without** dispatching to real handlers in production, and **without** replaying raw clinical payloads.

`dispatch_future` exists in the schema as a **reserved planning mode**; Stage 15 **does not** implement downstream dispatch and **blocks** execution for that mode.

## Approval workflow

1. **Draft** — A platform operator creates a run (`approval_status = draft`) with filters, `replay_mode`, and limits. Drafts may include `dispatch_future` for documentation only; execution remains blocked until a future stage implements governed dispatch.
2. **Submit for approval** — Draft → `pending_approval`. Requester attests the parameters are intentional.
3. **Approve / reject** — A second platform admin action (or the same role per org policy) sets `approved_by`, `approved_at`, and `approval_status = approved`, or `rejected` with optional reason recorded in `summary`.
4. **Execute** — Only from `approved`. Execution calls the existing Stage 14 `replayIntelligenceEventLogs` helper, records counts and warnings on the row, then sets `completed` or `failed`.

Human approval is required before any **governed** execution path mutates run state beyond draft creation. **Dry-run and validate-only remain the safe defaults** for ad-hoc CLI replay without a run record.

## Allowed modes

| `replay_mode`       | Stage 15 behavior |
|---------------------|-------------------|
| `dry_run`           | Allowed after approval when governed replay is enabled; loads candidates and records counts only. |
| `validate_only`     | Same; validates envelope shape from persisted metadata. |
| `enqueue_shadow`    | Same subject to Stage 12 queue policy (non-production + queue flag); **requires** allow-listed `event_name` and safe `privacy_level` policy (see below). |
| `dispatch_future`   | **Not executable** in Stage 15. Reserved for future governed dispatch; always blocked at execution time. |

## Strict allow-list requirements

- **`enqueue_shadow`**: `event_name` filter **must** be present and must appear in `GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST` (`src/lib/fi/events/governedReplayAllowlist.ts`). Names are intersected with `@follicle/intelligence-core` `INTELLIGENCE_EVENT_NAMES` so only contract-backed names are eligible.
- **`dispatch_future`**: Separate future allow-list is **empty** in Stage 15; no execution path is implemented.
- **Privacy**: Filters must not target **high-sensitivity clinical** tiers for shadow enqueue. Stage 15 treats `operational_clinical` as **disallowed** for `enqueue_shadow` (both as an explicit filter and for candidate rows selected without a privacy filter — operational rows are skipped with warnings rather than enqueued).

## Operator responsibilities

- Verify environment (non-production for shadow enqueue, flags documented below).
- Keep runs **least privilege**: tight `event_name`, `since` / `until`, and `limit_count`.
- Never paste raw PHI into run `summary`; use structured notes only.
- Pair approval with change management for any enqueue or future dispatch work.

## Production restrictions

- **`FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED`** must be `"1"` for governed **execute** paths (CLI and service). Default is off.
- **`FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED`** is reserved; **`dispatch_future` is always disabled in production** in Stage 15 and has **no** real dispatch implementation.
- **`enqueue_shadow`** remains subject to Stage 14 rules (`NODE_ENV !== production` and internal bus queue flag).
- **No automatic production dispatch**; all governed dispatch remains disabled by default.

## Audit requirements

- Every governed run row captures **who** requested (`requested_by`), **who** approved (`approved_by`), timestamps, mode, filters, counts, `summary` jsonb, and `warnings` text[].
- Operators should export or archive run rows as part of operational audits alongside `fi_intelligence_event_logs`.

## Rollback / disable plan

1. Unset **`FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED`** and **`FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED`** — governed execute and dispatch planning gates close immediately.
2. Stop using the replay CLI run subcommands; direct `--mode dry_run` replay remains available without governed flags (Stage 14 behavior unchanged).
3. **Database**: table is additive; to hard-disable reads from app code, remove or gate admin routes; to remove the feature entirely, drop `public.fi_intelligence_replay_runs` in a follow-up migration after backing up rows.

## Stage 16 recommendation

Ship a **production governance pack** before enabling any real event dispatch:

- Consent and data-processing policy documents tied to intelligence events.
- Retention and minimization policy for logs and replay runs.
- Operator runbook (who may approve, emergency contacts).
- Environment activation checklist (flags, Supabase roles, monitoring).
- Incident rollback checklist (disable flags, purge queues, communicate scope).
- Legal / privacy review checklist for `operational_clinical` and cross-system routing.

---

*See also:* [Stage 14 — Intelligence event log replay](./stage14-intelligence-event-log-replay.md)
