# FI OS Workflow Engine (v1)

Central, in-process workflow infrastructure for **listening to FI domain events** and running **registered automation handlers**. This module does **not** persist workflow runs yet, does **not** modify `ingestFiEvent`, and does **not** send email/SMS — it is the dispatch shell and typed contracts only.

## Modules

| File | Role |
|------|------|
| `workflowTypes.ts` | `WorkflowInvokeContext`, handler result shapes, `workflowPlaceholderSkipped` helper. |
| `workflowEngine.ts` | `WorkflowEngine` — register many handlers per `eventName`, `dispatch`, safe per-handler error capture, optional ephemeral idempotency, `dryRun` passthrough. |
| `workflowRegistry.ts` | `registerDefaultFiOsWorkflowHandlers` — wires domain registrations. |
| `consultationWorkflow.ts` | `consultation.completed` placeholder. |
| `pathologyWorkflow.ts` | `pathology.requested`, `pathology.result_uploaded` placeholders. |
| `surgeryWorkflow.ts` | `case.procedure_completed` placeholder. |
| `leadWorkflow.ts` | `crm.lead.stage_changed` placeholder. |

## Invoke context (`WorkflowInvokeContext`)

Handlers receive:

- `eventName`, `tenantId`, `occurredAt` (required), `payload`
- Optional: `clinicId`, `patientId`, `leadId`, `caseId`, `consultationId`, `pathologyRequestId`, `pathologyResultId`, `bookingId`, `actorUserId`
- `idempotencyKey` (optional) — forwarded for future outbox / dedupe tables; the engine also supports **process-local** dedupe when the same key is dispatched twice on the same `WorkflowEngine` instance (see `WorkflowEngineOptions.ephemeralIdempotency`).
- `dryRun` (optional, default `false`) — handlers must treat as “no irreversible side effects”; placeholders always return `skipped` but include `dryRun` in `detail`.

## Behaviour

- **Multiple handlers per event** — all matching registrations for an `eventName` run concurrently (`Promise.allSettled`); one failure does not stop others.
- **Statuses** — each handler returns `WorkflowHandlerResult` with `status`: `skipped` | `success` | `failed`. Thrown errors become `WorkflowHandlerRunRecord` with `status: "failed"` and `caughtError` (message + stack when available).
- **Not transactional** — `dispatch` does not open a database transaction. Producers (ingest handlers, CRM mutators, pathology writers) may already have committed their primary write before automation runs. If automation fails after that commit, **there is no automatic rollback** of the producer write. Coordinating “exactly-once side effects” requires a **transactional outbox** or **workflow run log + retry** (see below).
- **No external comms** — v1 handlers are placeholders; real implementations must not call Resend/Twilio from this layer directly; reuse existing policy-gated modules (e.g. reminder processor, pathology send-to-patient) behind explicit checks.

## Where this plugs into `ingestFiEvent` (later)

Today, producer events flow: HTTP → `ingestFiEvent` → per-type handlers → foundation dual-write / triggers (`docs/audits/fi-workflow-events-audit.md`).

**Recommended integration (future PR):**

1. After a handler successfully persists its primary outcome (and optional timeline/CRM rows), build a `WorkflowInvokeContext` from the same identifiers already on the envelope or resolver output.
2. Call `registerDefaultFiOsWorkflowHandlers()` once at process startup (or lazy on first dispatch in serverless — ensure idempotent registration).
3. `await workflowEngine.dispatch({ ... })` — do not block HTTP response on slow automations once an outbox exists; v1 synchronous call is acceptable only for fast handlers.

Non-ingest producers (`consultation.completed`, `crm.lead.stage_changed`, pathology mutators) should call the same `dispatch` helper from their mutation layer once event semantics are stable.

## Why this is not yet transactional

- Handlers will eventually perform writes across **CRM**, **timeline**, **reminders**, and **tasks**. Without an outbox, those writes are not in the same DB transaction as the originating mutation unless explicitly coordinated.
- **Ephemeral idempotency** in `WorkflowEngine` is **not** durable across deploys or serverless instances.

## Future: workflow run logging + transactional outbox

1. **Workflow run table** — append-only rows: `id`, `event_name`, `tenant_id`, `idempotency_key`, `status`, `started_at`, `finished_at`, per-handler JSON results, `error` summary. Enables ops replay and analytics.
2. **Transactional outbox** — in the same transaction as the business write, insert an `fi_workflow_outbox` row; a worker drains rows and calls `dispatch` (or handler-specific jobs). Guarantees at-least-once delivery with dedupe on `idempotency_key`.
3. **Cron / queue** — long-running automations move to job rows (similar pattern to `fi_reminder_jobs`).

## OS coverage (product map)

| OS / surface | How workflows help |
|--------------|-------------------|
| **ConsultationOS** | Post-consult rules, template-driven follow-ups, linkage to bookings and Twin projections (`consultation.completed`). |
| **DoctorOS** | Pathway tasks around labs and results (`pathology.*`). |
| **SurgeryOS** | Procedure completion triggers post-op bundles and readiness (`case.procedure_completed`). |
| **Patient Twin** | Read-model enrichment and timeline-friendly summaries from structured handler `detail` (no duplicate timeline writer required in v1). |
| **Reminders** | Stage and consultation events align with `REMINDER_TRIGGER_EVENTS` — handlers enqueue or sync jobs via existing reminder libraries, not raw providers. |
| **Patient Portal (future)** | Same workflow events can drive patient-visible status (e.g. lab requested, result ready, next steps) via portal-specific read models or notification prefs — still **no** direct email/SMS from this engine; portal surfaces consume outcomes written by handlers or outbox workers once those exist. |

## Event name alignment

Placeholder names are stable **workflow** names. Some **existing** code paths emit different strings today (e.g. CRM activity `pathology.blood_result.uploaded` per audit). When wiring producers, map or dual-emit to the workflow `eventName` you dispatch here.
