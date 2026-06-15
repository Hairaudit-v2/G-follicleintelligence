# Intelligence operator runbook

**Audience:** Platform operators with **service-role** access to Supabase and permission to run **approved** maintenance scripts.

** Preconditions:** Read [Stage 13](../stage13-persistent-intelligence-event-log.md), [Stage 14](../stage14-intelligence-event-log-replay.md), and [Stage 15](../stage15-governed-intelligence-replay-dispatch.md). Complete [environment activation checklist](./environment-activation-checklist.md) before changing flags in shared environments.

---

## 1. Inspect event logs

1. Confirm migration `fi_intelligence_event_logs` is applied (see Stage 13 migration name in repo).
2. Query `public.fi_intelligence_event_logs` via Supabase SQL or trusted admin UI routes (service role behind auth).
3. Filter by `event_name`, `source`, `status`, `created_at` windows — **never** expect raw clinical payload columns; they must not exist.
4. Correlate with `correlation_id` when investigating multi-step flows.

---

## 2. Run dry-run replay

**Purpose:** Count candidates and validate filters **without** mutating handlers or enqueueing shadow traffic.

```bash
pnpm run replay:intelligence-event-logs -- --mode dry_run --limit 50 --json
```

Optional filters (see Stage 14 CLI reference): `event_name`, `source`, `privacy_level`, time bounds.

**Expect:** JSON summary with `candidates_loaded`, no shadow enqueue counts in production.

---

## 3. Validate-only replay

**Purpose:** Check envelope shape from persisted metadata only.

```bash
pnpm run replay:intelligence-event-logs -- --mode validate_only --limit 50 --json
```

Use after schema or contract changes to detect incompatible historical rows.

---

## 4. Create replay run drafts (governed)

**Requires:** Migration `fi_intelligence_replay_runs` applied; service role env for script.

```bash
pnpm run replay:intelligence-event-logs -- --create-run --mode dry_run --event-name hairaudit.audit.completed --limit 10 --json
```

- **`enqueue_shadow` drafts** require allow-listed `event_name` and safe privacy filters (see Stage 15).
- **`dispatch_future`** may appear **only** as a planning row; it is **never executable** today.

---

## 5. Submit and approve runs

```bash
pnpm run replay:intelligence-event-logs -- --submit-for-approval <run-id> --json
pnpm run replay:intelligence-event-logs -- --approve-run <run-id> --json
```

**Segregation of duties:** prefer **different** operator identities for submit vs approve where org policy requires it.

---

## 6. Execute approved runs

```bash
pnpm run replay:intelligence-event-logs -- --execute-run <run-id> --json
```

**Requires:** `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=1` in the script environment.

**Executes:** Stage 14 replay for `dry_run`, `validate_only`, or `enqueue_shadow` (subject to queue + non-production rules for shadow).

**Blocks:** `dispatch_future` always returns `dispatch_future_blocked` — **no downstream dispatch**.

---

## 7. What must never be run in production (today)

| Action | Reason |
|--------|--------|
| Expect **`enqueue_shadow`** to enqueue real handlers in **production** | Hard-off: `NODE_ENV === "production"` blocks queue replay path |
| Enable **`FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED`** expecting inserts in production | Application forces persistence **off** in production |
| Rely on **`FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED`** to enable partner dispatch | **No dispatch implementation**; flag is reserved |
| Paste **PHI** into CLI notes or DB `summary` JSON | Violates minimization; may breach policy |
| Widen **`GOVERNED_*_ALLOWLIST`** without architecture review | Requires code change + governance |

---

## 8. Environment flags and defaults

| Variable | Default | Meaning |
|----------|---------|---------|
| `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED` | unset / not `1` | Durable log inserts gated; **production always off** in code |
| `FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED` | unset | Shadow bus emission |
| `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED` | unset | In-memory queue (non-production) |
| `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED` | unset | Governed execute / CLI execute-run |
| `FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED` | unset | Reserved; does **not** enable production dispatch |

See `src/lib/fi/events/*Env.ts` for authoritative helpers.

---

## 9. Escalation

If replay or logging behavior diverges from this runbook, follow [incident rollback checklist](./incident-rollback-checklist.md) and notify security / platform leads.
