# Stage 17 — Staging-only activation path for allow-listed replay

## Purpose

Stage 17 adds an **explicit, narrow staging gate** so operators can execute **one** pre-approved governed replay run in **shadow enqueue** mode for **`hairaudit.audit.completed`**, validate observability, and rehearse rollback — **without** enabling production dispatch, **without** widening production allow-lists, **without** new production network integrations, and **without** changing FI ingest or handler code paths.

This path is **opt-in**, **non-production only**, and still uses the existing Stage 14 replay engine (metadata-only envelopes, no raw clinical payloads) and Stage 15 `executeApprovedReplayRun` approval flow.

## Staging-only activation rules

Staging activation is considered **on** only when **all** of the following hold:

1. `NODE_ENV !== "production"` (including the empty-string case: treated as non-production for this check, but production is strictly `NODE_ENV === "production"`).
2. `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED === "1"` (governed replay must already be enabled).
3. `FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED === "1"`.
4. `FI_INTELLIGENCE_STAGING_ALLOWED_EVENT` is set **exactly** to `hairaudit.audit.completed` (no other value enables staging activation).

If `NODE_ENV === "production"`, staging activation is **always false**, even when the above env vars are set.

**No automatic dispatch:** activation only unlocks the **CLI** (`--staging-activate-run`) and the **server wrapper** `runStagingIntelligenceReplay`; nothing runs without an approved run id and operator invocation.

## Required env flags

| Variable | Required value | Role |
|----------|----------------|------|
| `NODE_ENV` | Not `production` | Hard gate |
| `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED` | `1` | Aligns with Stage 15 execute policy |
| `FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED` | `1` | Explicit staging opt-in |
| `FI_INTELLIGENCE_STAGING_ALLOWED_EVENT` | `hairaudit.audit.completed` | Prevents accidental widening via a stray value |

Optional but typical for shadow enqueue validation:

- `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED=1` — so `enqueue_shadow` can land on the process-local queue (Stage 12). Disable to validate “queue off” behavior.

## Allowed event

- **`hairaudit.audit.completed`** — the only event name permitted by `stagingActivationAllowlist.ts` and by the staging env contract.

The broader **governed** `enqueue_shadow` allow-list in `governedReplayAllowlist.ts` is unchanged; Stage 17 does **not** expand it for production.

## Validation steps

1. Confirm `NODE_ENV` is not `production` on the target host.
2. Set the four activation flags above (governed replay + staging activation + allowed event string).
3. Create a governed replay run with `--mode enqueue_shadow`, `--event-name hairaudit.audit.completed`, and a **non-`operational_clinical`** `privacy_level` (same rules as Stage 15).
4. Submit and approve the run through the existing workflow.
5. Run:

   `pnpm run replay:intelligence-event-logs -- --staging-activate-run <run-id> --json`

6. Inspect JSON output: `replay_summary`, warnings, and `rollback_instructions`.
7. Observability: confirm replay run row updated in `fi_intelligence_replay_runs`, and logs/metrics you use for Stage 12 shadow queue depth behave as expected (org-specific).

## Rollback steps

1. Set **`FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED=0`** (or unset) — disables the Stage 17 entry points immediately.
2. Set **`FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=0`** (or unset) — blocks all governed execute paths (CLI `--execute-run` and `--staging-activate-run` both require governed replay for the underlying execute).
3. Set **`FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED=0`** (or unset) — stops new shadow enqueues from entering the process-local queue (Stage 12).
4. **Inspect** the replay run row (`fi_intelligence_replay_runs`) and **intelligence event logs** (`fi_intelligence_event_logs`) for the correlation window you tested.
5. **Restart** the process if you need to **clear the in-memory shadow queue** (queue is not durable).

No destructive SQL is required for rollback; configuration and process restarts are sufficient.

## Observability checks

- Governed replay run: `approval_status`, `replay_mode`, `event_name`, counts, `warnings`, `summary.replay_summary` after execute.
- Shadow queue: internal bus metrics / logs you already use for Stage 12 (if queue enabled).
- No new outbound “dispatch” integrations: `enqueue_shadow` still only uses `replayIntelligenceEventLogs` → `enqueueInternalIntelligenceEvent` when queue env allows.

## What remains disabled in production

- **Staging activation** is **always false** when `NODE_ENV === "production"`.
- **`dispatch_future`** remains unimplemented and blocked in `executeApprovedReplayRun`.
- **`FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED`** does not enable staging activation and does not add production dispatch.
- Production is **not** given a wider shadow allow-list via Stage 17 code paths.

## References

- Stage 15: `docs/stage15-governed-intelligence-replay-dispatch.md`
- Stage 16 governance pack: `docs/governance/README.md`
- Rollback checklist: `docs/governance/incident-rollback-checklist.md`
