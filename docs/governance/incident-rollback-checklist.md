# Incident rollback checklist (intelligence bus, replay, integrations)

**When to use:** Suspected data leak, runaway replay, incorrect exports, webhook abuse, or abnormal intelligence traffic.

**Goal:** Contain blast radius, preserve evidence, restore safe defaults, communicate clearly.

---

## 1. Disable environment flags

Unset or set to non-activating values (see [intelligence operator runbook](./intelligence-operator-runbook.md)):

- `FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED`
- `FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED`
- `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED`
- `FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED`
- `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED`

Redeploy or restart workers so long-lived processes pick up changes.

---

## 2. Stop replay

- Halt operator scripts (`replay:intelligence-event-logs`) and any cron invoking them.
- Mark in-flight governed runs as **failed** or **cancelled** only per DBA / app guidance (prefer app-level status if implemented).

---

## 3. Revoke or rotate webhook secrets

- Invalidate compromised signing secrets at the provider.
- Update server env vars; verify old signatures **fail** after rotation.

---

## 4. Inspect replay runs

Query `public.fi_intelligence_replay_runs` for the incident window:

- `replay_mode`, filters, `approval_status`, `requested_by`, `approved_by`, counts, `warnings`.

Export rows for post-incident review.

---

## 5. Inspect event logs

Query `public.fi_intelligence_event_logs` (if persistence was on in that environment):

- Spike in `error` status, unusual `event_name` / `source` pairs, correlation clusters.

---

## 6. Notify stakeholders

- Security / platform on-call.
- Product owners for affected brands (FI, HairAudit, IIOHR, HLI).
- Legal / privacy if PHI or regulated health data may be involved.

---

## 7. Data cleanup review

- Decide whether rows must be **purged**, **redacted**, or **retained** under legal hold.
- **Do not** bulk-delete without DBA review and backup.

---

## 8. Post-incident review

Within agreed SLA:

- Timeline, root cause, detection gaps.
- Action items: code fixes, new tests (e.g. guardrail tests), doc updates.
- Link to [environment activation checklist](./environment-activation-checklist.md) updates if flags or monitoring changed.
