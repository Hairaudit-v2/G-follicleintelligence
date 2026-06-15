# Environment activation checklist (intelligence / cross-system)

**Use before** any production toggle is enabled for intelligence persistence, governed replay execution, outbound export automation, or cross-system dispatch.

**Default posture:** All such capabilities remain **disabled** or **blocked** until governance sign-off (see [governance README](./README.md)).

---

## Checklist

- [ ] **Migrations applied** — `fi_intelligence_event_logs`, `fi_intelligence_replay_runs`, and any export audit tables required for the change are applied in the target project and verified with `supabase migration list` / team process.
- [ ] **Service-role access reviewed** — Supabase `service_role` key scope minimized; only trusted server runtimes hold it; rotation date recorded.
- [ ] **Environment flags reviewed** — Every `FI_INTELLIGENCE_*` flag documented in runbooks; values in Vercel / GitLab / shell match intended environment; **no accidental `production` + shadow queue** combination.
- [ ] **Webhook endpoints secured** — TLS, auth (signed secrets or mTLS per partner), IP allowlists where applicable, and **no** secrets in client bundles.
- [ ] **Secret rotation plan** — Owner, calendar reminder, and break-glass procedure if a key leaks.
- [ ] **Dry-run replay completed** — Operator ran `dry_run` / `validate_only` against representative filters; counts sane; no unexpected `load_error`.
- [ ] **Legal / privacy sign-off** — [Legal / privacy review checklist](./legal-privacy-review-checklist.md) completed and stored per org policy.
- [ ] **Rollback tested** — Disable flags, confirm app behavior returns to safe baseline; database additive changes have documented rollback or compensating controls.
- [ ] **Monitoring owner assigned** — Dashboards / alerts for insert failures, replay failures, webhook 4xx/5xx, and anomaly spikes.

---

## Explicit exclusions (Stage 16)

The following are **out of scope** for “checklist complete” until a future approved stage:

- Enabling **`dispatch_future`** execution or widening **`GOVERNED_DISPATCH_FUTURE_ALLOWLIST`**.
- Turning on **production** `fi_intelligence_event_logs` inserts while application policy still forces production persistence off — requires a **new policy stage** and code change review.
- Adding **production network calls** from replay or ingest paths solely via documentation.

---

## Sign-off block

| Role | Name | Date |
|------|------|------|
| Engineering lead | | |
| Security / platform | | |
| Legal / privacy | | |
