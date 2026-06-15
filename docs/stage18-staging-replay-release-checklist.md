# Stage 18 — Staging replay release checklist

Use this checklist before and after a **staging-only** governed replay rehearsal. **No production activation.**

Evidence columns: link to ticket, timestamp, operator id, and pasted JSON snippet or log pointer.

---

## Environment

- [ ] Target is **staging** (or non-prod) — not production.
- [ ] `NODE_ENV` is **not** `production`.
- [ ] Supabase URL + **service role** present for operator CLI host.
- [ ] Stage 18 runbook read: `docs/stage18-staging-replay-validation-runbook.md`.

## Migrations

- [ ] All pending FI intelligence migrations applied to staging DB.
- [ ] `fi_intelligence_event_logs` and `fi_intelligence_replay_runs` verified (admin UI or SQL).

## Env flags (gated rollout)

- [ ] Initial state: governed replay **off** unless needed for a step.
- [ ] Staging activation flags **off** until section F of runbook.
- [ ] Internal bus queue flag documented as on/off per rehearsal goal.

## Dry-run evidence

- [ ] Command from runbook §B executed.
- [ ] JSON shows `summary.candidates_loaded` and no `load_error` (or failure documented).
- [ ] Filters used **`hairaudit.audit.completed`**.

## Validate-only evidence

- [ ] Command from runbook §C executed.
- [ ] `validated_ok` / `validated_failed` recorded; warnings reviewed.

## Run approval evidence

- [ ] Draft `enqueue_shadow` run created (§D); `approval_status=draft`.
- [ ] Submitted → `pending_approval`; approved → `approved`.
- [ ] Approver identity recorded (org policy).

## Enqueue-shadow (staging activation) evidence

- [ ] All Stage 17 activation env vars set exactly as runbook §F.
- [ ] `--staging-activate-run <id> --json` executed (not production).
- [ ] `replay_summary` / `warnings` / `rollback_instructions` captured.

## Rollback drill evidence

- [ ] Flags disabled per runbook §H.
- [ ] Process restart noted if queue cleared.
- [ ] Replay run + logs inspected post-drill.

## Sign-offs

| Role | Name | Date | Notes |
|------|------|------|-------|
| Operator | | | |
| Engineering owner | | | |
| Security / privacy (if required) | | | |

## Open risks

| Risk | Mitigation | Owner |
|------|------------|-------|
| | | |

---

**No production activation:** do not enable production dispatch, widen allow-lists, or turn this rehearsal into automated replay without a new governance stage.
