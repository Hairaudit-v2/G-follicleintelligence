# Consultation Automation Orchestrator v1

This document describes **`runConsultationCompletionAutomation`** in `src/lib/consultations/consultationAutomation.server.ts`: trusted-server orchestration for the four consultation completion handoffs documented in `docs/audits/consultation-automation-plan.md` and `docs/audits/fi-workflow-events-audit.md`.

## Why it is not wired automatically yet

- **Product:** Guided completion today is explicitly **clinician-triggered** for handoffs (`ConsultationHandoffPanel` copy). Auto-running changes CRM, quotes, pathology, and surgery plan data without an extra confirmation step.
- **Governance:** Quote drafts and surgery planning drafts carry **commercial and clinical** weight; rollout needs tenant flags, audit, and medico-legal sign-off (see audit §5–6).
- **Engineering:** The orchestrator is isolated so we can add **workflow run logging**, **transactional outbox**, and **tenant policy** before coupling to `completeConsultationFormInstance` or HTTP latency-sensitive paths.

## Integration with Workflow Engine v1 / `consultation.completed`

Recommended sequence (future):

1. `completeConsultationFormInstance` finishes and persists a **locked** instance with `rules_v1` `completion_summary` (today’s behaviour).
2. A workflow handler for **`consultation.completed`** (see `src/lib/workflows/` and audit §3) loads `tenantId`, `formInstanceId`, `consultationId`, and optional `actorUserId` from the completion payload / DB.
3. The handler calls **`runConsultationCompletionAutomation({ tenantId, formInstanceId, actorUserId, dryRun: false, enabledHandoffs: tenantPolicy })`**.
4. Handler returns structured handoff results into workflow run storage (once migrations exist).

Keeping completion and orchestration **decoupled** preserves a single completion transaction and allows **best-effort** handoffs with per-step errors (audit §5.3).

## Quote governance rule

- **Default (`enabledHandoffs` omitted):** Quote draft is **not** attempted unless `quoteDraftAutomationIntentEligible(summary)` is true (`src/lib/consultationForms/handoff/consultationHandoffPure.ts`) — e.g. `proceed_surgery` / `proceed_prp` / `proceed_exosomes`, non-empty quote notes, recommended procedure, or recommended treatments.
- **Explicit opt-in:** If callers pass `enabledHandoffs: { quote_draft: true, ... }`, quote evaluation runs **even without** those intent signals (still subject to locked context + lead/case anchor checks inside mutations).

This mirrors the audit recommendation to avoid creating a draft for **every** locked completion that merely has a lead/case anchor.

## Actor attribution

- **`actorUserId`** is forwarded to **`createConsultationFollowUpTaskFromSummary`** (assignee), **`createConsultationPathologyRecommendationFromSummary`** (`doctorUserId`), and other mutations that accept `ConsultationHandoffBaseInput.actorUserId`.
- For automation, prefer **`completedByUserId`** from the completion event when wiring later, or a **tenant-scoped system user** id documented in ops runbooks — never infer from unauthenticated client-only context.

## Idempotency expectations

Each underlying mutation implements **read-before-write reuse** (tasks, quotes, pathology requests, surgery plan metadata) as documented in the audit. The orchestrator:

- Invokes those mutations **sequentially** so partial success is visible per handoff.
- On **`dryRun: true`**, performs **no writes**; uses **`loadConsultationHandoffState`** (read-only) to describe reuse vs would-create.

Ephemeral or cross-process idempotency is **not** guaranteed by the orchestrator alone; durable dedupe remains with the existing tables + metadata keys until an **outbox** dedupes dispatch.

## Rollout plan

1. **v1 (current):** Orchestrator callable from scripts / internal tooling / future workflow handler; **not** invoked from `completeConsultationFormInstance`.
2. **v2:** Tenant metadata flags for which handoffs to auto-run; log structured results (DB column or append-only table).
3. **v3:** Wire **either** inline after completion **or** `consultation.completed` workflow dispatch; surface `handoffs` in the completion action response for UI toasts.
4. **v4:** Transactional outbox for at-least-once automation with replay and observability.

## Related source

| Area | File |
|------|------|
| Orchestrator (server) | `src/lib/consultations/consultationAutomation.server.ts` |
| Quote policy (testable, no `server-only`) | `src/lib/consultations/consultationAutomationPolicy.ts` |
| Mutations + `requireLockedHandoffContext` | `src/lib/consultationForms/handoff/consultationHandoffMutations.server.ts` |
| Pure gates + quote intent helper | `src/lib/consultationForms/handoff/consultationHandoffPure.ts` |
| Completion (no handoffs) | `src/lib/consultationForms/consultationFormMutations.server.ts` |
