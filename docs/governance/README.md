# Follicle Intelligence — production governance pack (Stage 16)

**Status:** Reference documentation and enforcement guardrails only. **No production activation** of cross-system dispatch, FI import bridges, HLI / HairAudit / IIOHR export execution, or governed `dispatch_future` replay is authorized until governance sign-off is complete.

**Audience:** Platform operators, security / compliance, engineering leads, and legal / privacy reviewers working across **FI OS**, **HairAudit**, **IIOHR**, and **HLI**.

---

## Purpose

Stage 16 defines the **minimum governance surface** required before any of the following may be considered for non-local environments:

- Real cross-system **dispatch** (webhooks, outbound buses, partner APIs).
- **FI import** automation that mutates production tenant data from external systems.
- **HLI**, **HairAudit**, or **IIOHR** **export** paths that leave controlled boundaries.
- **Governed replay** modes that enqueue shadow traffic or future dispatch beyond today’s intentionally constrained behavior.

Today’s codebase keeps **dispatch disabled**, **event allow-lists narrow**, **no new production network integrations** for intelligence replay, **ingest and auth unchanged**, **handlers unchanged**, **no raw clinical payloads** in intelligence event logs, and **production intelligence event log persistence off** by application policy (see `docs/stage13-persistent-intelligence-event-log.md`).

---

## Document index

| Document | Use when |
|----------|----------|
| [Consent and data use policy](./consent-and-data-use-policy.md) | Defining what may move between systems vs what stays local; consent and revocation concepts. |
| [Data retention policy](./data-retention-policy.md) | Retention classes, deletion / anonymisation, and review triggers for logs and replay metadata. |
| [Intelligence operator runbook](./intelligence-operator-runbook.md) | Day-to-day inspection, dry-run / validate-only replay, governed run lifecycle, and forbidden operations. |
| [Environment activation checklist](./environment-activation-checklist.md) | Pre-flight before any production flag may be enabled (with explicit governance approval). |
| [Incident rollback checklist](./incident-rollback-checklist.md) | Containment and recovery when intelligence bus, replay, or integration behavior misbehaves. |
| [Legal / privacy review checklist](./legal-privacy-review-checklist.md) | PHI/PII classification, consent, transfers, and domain-specific sensitivities. |

---

## Related engineering stages

- [Stage 13 — Persistent intelligence event log](../stage13-persistent-intelligence-event-log.md)
- [Stage 14 — Intelligence event log replay](../stage14-intelligence-event-log-replay.md)
- [Stage 15 — Governed intelligence replay and dispatch planning](../stage15-governed-intelligence-replay-dispatch.md)
- [Ecosystem integration guardrails](../ecosystem-integration-guardrails.md)

---

## Enforcement in repo

- Source-contract tests under `src/lib/fi/events/intelligenceCore.stage16.test.ts` assert default-off posture for governed replay / dispatch gates, production persistence off, empty `dispatch_future` allow-list, and related invariants.
- Allow-lists and execution gates live in `src/lib/fi/events/` (`governedReplayAllowlist.ts`, `governedReplayEnv.ts`, `intelligenceReplayRunService.server.ts`, `persistentEventLogEnv.ts`).

---

## Sign-off model (conceptual)

Production enablement requires **documented approval** aligned with the checklists in this folder. Until then, treat all intelligence dispatch and persistence toggles as **development / staging experimentation only**, subject to the same minimization and no-PHI-storage rules as production-oriented code paths.
