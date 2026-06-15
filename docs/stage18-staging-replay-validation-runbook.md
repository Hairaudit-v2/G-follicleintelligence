# Stage 18 — Staging replay validation runbook (operator)

## Scope and non-goals

This runbook supports **staging rehearsal only**: **dry-run → validate-only → governed run draft → approval → staging enqueue-shadow activation → observability → rollback drill**.

**No production activation.** Staging replay does **not** enable production dispatch, does **not** add production network calls, does **not** widen allow-lists, does **not** change ingest or handlers, does **not** store raw clinical payloads, and does **not** perform automatic replay. It is operator-driven validation and documentation-backed governance only.

**Target event for staging activation path:** `hairaudit.audit.completed` only (fixed allow-list; see Stage 17).

**References:** Stage 17 path (`docs/stage17-staging-activation-path.md`), Stage 15 governed replay (`docs/stage15-governed-intelligence-replay-dispatch.md`), governance pack (`docs/governance/README.md`).

---

## A. Preconditions

| Check | Operator action |
|--------|------------------|
| **Migrations applied** | Confirm `public.fi_intelligence_event_logs` and `public.fi_intelligence_replay_runs` exist on the target Supabase project (apply pending migrations before rehearsal). |
| **NODE_ENV is non-production** | Shell / deployment must **not** set `NODE_ENV=production`. Empty `NODE_ENV` is treated as non-production for staging activation, but prefer an explicit non-production value (e.g. `staging`, `development`, `test`). |
| **Service role available** | Operator machine can build a Supabase **service-role** client (same credentials the replay script uses via `lib/supabaseAdmin` / project env). Do not use anon keys for write paths. |
| **Governance docs reviewed** | Read `docs/governance/README.md`, `docs/governance/environment-activation-checklist.md`, and Stage 17 staging activation doc. |
| **Env flags initially off** | Before dry-run, keep **off** (unset or not `1` where noted): `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED`, `FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED`, `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED` (optional until shadow enqueue section). |
| **Target event** | Staging activation and rehearsal filters use **`hairaudit.audit.completed`** only for the Stage 17 activation contract. |

---

## B. Dry-run

### Command

```bash
pnpm run replay:intelligence-event-logs -- --mode dry_run \
  --event-name hairaudit.audit.completed \
  --privacy-level internal_debug \
  --limit 10 \
  --json
```

Adjust `--limit`, optional `--since` / `--until` / `--correlation-id` as needed; keep **`hairaudit.audit.completed`** for this rehearsal track.

### Expected JSON fields (stdout)

Single JSON object with at least:

| Field | Meaning |
|--------|---------|
| `mode` | `"dry_run"` |
| `filters` | Echo of parsed filters (e.g. `event_name`, `privacy_level`, `limit`) |
| `summary` | Object including `mode`, `candidates_total`, `candidates_loaded` |
| `warnings` | Array (often empty in healthy runs) |
| `load_error` | Omitted when load succeeded; present (string) when the log query failed |

### Pass / fail

- **Pass:** `load_error` absent; `summary.candidates_loaded` is a non-negative integer; process exits **0**; no unexpected stderr beyond tool noise.
- **Fail:** `load_error` set, or CLI parse error (exit **2**), or missing `summary` / malformed JSON.

---

## C. Validate-only

### Command

```bash
pnpm run replay:intelligence-event-logs -- --mode validate_only \
  --event-name hairaudit.audit.completed \
  --privacy-level internal_debug \
  --limit 10 \
  --json
```

### Expected warnings behavior

- Rows that cannot be turned into a strict shadow envelope produce **`warnings`** entries with `code: "validate_parse_failed"` and `intelligence_event_log_id` set when applicable.
- `summary` includes `validated_ok` and `validated_failed` counts.

### Pass / fail

- **Pass:** `load_error` absent; `validated_ok + validated_failed === summary.candidates_loaded`; process exits **0**.
- **Fail:** `load_error` present, or parse errors; or `validated_failed` unexpectedly high without documented cause (investigate bad rows, not allow-list changes).

---

## D. Create replay run draft

### Command

```bash
pnpm run replay:intelligence-event-logs -- --create-run --mode enqueue_shadow \
  --event-name hairaudit.audit.completed \
  --privacy-level internal_debug \
  --limit 5 \
  --json
```

`enqueue_shadow` drafts require **allow-listed** `event_name` and a **non-`operational_clinical`** privacy filter (same Stage 15 rules).

### Expected response fields

| Field | Meaning |
|--------|---------|
| `action` | `"create_run"` |
| `ok` | `true` on success |
| `id` | New run UUID (when `ok`) |
| `filters`, `mode` | Echo |

### Expected `approval_status`

New row is created as **`draft`** in `fi_intelligence_replay_runs` (not returned in this JSON line; verify in admin UI or SQL).

### Filters required (staging rehearsal)

- **`--event-name hairaudit.audit.completed`** — required for later staging activation allow-list alignment.
- **`--privacy-level`** — explicit non-operational level (e.g. `internal_debug`).
- **`--limit`** — bounded batch.

---

## E. Submit and approve run

### Commands

Replace `<run-id>` with the UUID from section D.

```bash
pnpm run replay:intelligence-event-logs -- --submit-for-approval <run-id> --json
pnpm run replay:intelligence-event-logs -- --approve-run <run-id> --json
```

### Expected statuses

| Step | `approval_status` in DB |
|------|-------------------------|
| After create (D) | `draft` |
| After submit | `pending_approval` |
| After approve | `approved` |

JSON lines: `action` is `submit_for_approval` / `approve_run`; `ok: true` with `id` echo on success.

### Platform admin / operator requirements

- **Two-person discipline (recommended):** requester vs approver per org policy; the CLI uses `omitPlatformAdminAssertForOperatorCli` for trusted operator shells — **still** enforce human approval out-of-band.
- **Service role** on the operator host for these mutations.
- **No `--execute-run` for staging shadow rehearsal** if you are following the Stage 17 activation path: use **`--staging-activate-run`** in section F instead (keeps activation gated separately from generic execute).

---

## F. Staging enqueue-shadow activation

### Required env flags

Set **all** of the following in the shell (or process env) **before** `--staging-activate-run`:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | Not `production` |
| `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED` | `1` |
| `FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED` | `1` |
| `FI_INTELLIGENCE_STAGING_ALLOWED_EVENT` | `hairaudit.audit.completed` (exact string) |
| `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED` | `1` (to observe shadow enqueue into the process-local queue) |

### Command

```bash
pnpm run replay:intelligence-event-logs -- --staging-activate-run <approved-run-id> --json
```

`--json` is **mandatory** for this flag.

### Expected summary

JSON includes:

| Field | Meaning |
|--------|---------|
| `action` | `"staging_activate_run"` |
| `ok` | `true` when execution succeeded |
| `replay_summary` | Same shape as governed execute: mode counts (`shadow_enqueued`, etc.) |
| `warnings` | Array |
| `load_error` | Optional string |
| `rollback_instructions` | Always present (copy for incident notes) |

### Expected queue / log behavior

- With internal bus queue enabled and non-production: **`shadow_enqueued`** may increment for valid candidates; no new outbound “dispatch” integrations.
- **No raw clinical payload** reconstruction: shadow envelopes use the Stage 14 replay marker payload only.
- Replay run row moves through execution completion fields per Stage 15 service (inspect `summary` / `completed_at` in DB or admin UI).

---

## G. Observability checks

| Surface | What to verify |
|---------|----------------|
| **Admin UI** | `/fi-admin/system/intelligence-event-logs/replay` — env gate readout, recent runs table (`approval_status`, `replay_mode`, `event_name`, counts, warnings). |
| **Event logs** | `/fi-admin/system/intelligence-event-logs` — correlation window for replayed log ids (metadata only). |
| **Replay runs** | Row for `<run-id>`: final status, `replay_mode`, warning counts, stored `summary`. |
| **Queue snapshot** | If you expose Stage 12 queue depth / logs, confirm bumps only during `enqueue_shadow` when queue env is on; otherwise expect skip warnings. |
| **Warnings / errors** | Scan CLI JSON `warnings` and admin warning columns; investigate `validate_parse_failed` or `enqueue_shadow_skipped` codes. |

---

## H. Rollback drill

1. **Disable flags:** `FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED=0` (unset), then `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=0`, then `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED=0` as needed.
2. **Clear queue if needed:** In-memory queue is per process — **restart** the app/worker to drop queued shadow items after a test.
3. **Inspect replay run:** Confirm row shows terminal state from drill; no unexpected `dispatch_future`.
4. **Inspect event logs:** Confirm no unintended duplicate patterns beyond the rehearsal window.
5. **Record notes:** Paste `rollback_instructions` from the last JSON output into the change ticket / `docs/stage18-staging-replay-release-checklist.md` evidence section.

---

## I. Production reminder

- **Production remains disabled** for this sprint: staging activation is **false** when `NODE_ENV === "production"`.
- **`dispatch_future`** is **not** implemented: blocked for direct replay and for governed **execute** paths.
- **No downstream network** from replay; shadow path uses in-memory bus enqueue only when explicitly enabled and non-production.
- **No automatic sync** or scheduled replay: only operator CLI / approved run + explicit `--staging-activate-run`.
