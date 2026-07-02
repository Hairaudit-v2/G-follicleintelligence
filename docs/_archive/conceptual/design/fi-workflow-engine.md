# FI Workflow Automation Engine

**Status:** Architecture implemented (in-process registry + dispatcher).  
**Scope:** No UI, no cron, no external integrations — foundation only under `src/lib/workflows/`.

---

## 1. Purpose

Provide a **central, tenant-scoped workflow dispatch surface** so FI OS can:

- Emit **logical workflow events** with a stable shape (`eventName`, `entityType`, `entityId`, `tenantId`, `payload`).
- **Register** multiple independent handlers per event.
- **Execute** all matching handlers for a single dispatch, with isolated outcomes (one handler failing does not block others).

This layer is **orthogonal** to `fi_events` producer ingestion (`POST /api/fi/events`). Future work can **bridge** ingest handlers or domain mutators into `workflowEngine.dispatch()` without changing the engine contract.

---

## 2. Layout

| Path | Role |
|------|------|
| `src/lib/workflows/workflowTypes.ts` | Shared types: context, handler signature, registration, dispatch result. |
| `src/lib/workflows/workflowEngine.ts` | `WorkflowEngine` class + default singleton `workflowEngine`. |
| `src/lib/workflows/index.ts` | Public barrel exports. |

All engine code is marked **`server-only`** (via `workflowEngine.ts`) so it is not imported from client components.

---

## 3. Event context contract

Every dispatch uses **`WorkflowEventContext`**:

| Field | Required | Description |
|-------|----------|-------------|
| `eventName` | Yes | Logical name (e.g. `crm.lead.stage_changed`, `booking.completed`). Convention is dot-separated lowercase; not enforced in code. |
| `entityType` | Yes | Kind of primary entity (`case`, `lead`, `booking`, …). |
| `entityId` | Yes | Primary key of that entity in FI. |
| `tenantId` | Yes | Tenant scope. |
| `payload` | Yes | Arbitrary JSON-serializable map; handlers narrow as needed. |
| `occurredAt` | No | ISO time when the business event happened. |
| `correlationId` | No | Trace id across handlers or upstream systems. |

Empty strings for required string fields are rejected at `dispatch` time.

---

## 4. Handler registration

Handlers are registered with **`WorkflowHandlerRegistration`**:

- **`id`** — Stable string; used in results and for `unregister`.
- **`eventName`** — Exact match after trim (no glob patterns in v1).
- **`entityType`** — Optional filter: if set, the handler runs only when `context.entityType` equals this value; if omitted, the handler runs for that event for **any** entity type.
- **`handler`** — Async-capable function returning **`WorkflowHandlerResult`** (`ok`, optional `code`, `error`, `metadata`).

**API:**

- `register(reg)` — Returns an **unsubscribe** function. Registering the same `id` again **replaces** the previous registration.
- `unregister(handlerId)` — Removes by id.
- `clear()` — Wipes all registrations (intended for tests).

**Default singleton:** `workflowEngine` — shared process-wide registry. Tests may use `new WorkflowEngine()` for isolation.

---

## 5. Dispatch semantics

- **`dispatch(ctx)`** resolves all handlers that match `ctx.eventName` and optional `entityType` filter.
- Matching handlers run **concurrently** via `Promise.allSettled`.
- Each handler’s return value is normalized to `WorkflowHandlerResult`; thrown errors become `{ ok: false, code: 'handler_threw', error }`.
- **`WorkflowDispatchResult`** echoes identifiers and lists **`handlerResults`** `{ handlerId, result }[]` (order not guaranteed due to concurrency).

**Idempotency and side effects** are **not** enforced by the engine; handlers own deduplication and transactional boundaries.

---

## 6. Non-goals (this revision)

| Excluded | Rationale |
|----------|-----------|
| UI | Product surfaces call `dispatch` or register in server modules. |
| Cron | Scheduled work stays in existing cron routes until explicitly bridged. |
| External integrations | No HTTP, queues, or webhooks inside the engine. |
| Persistence | No `fi_workflow_*` tables; replay and audit are future layers. |
| Event name patterns | Only exact `eventName` match; wildcards can be a later extension. |

---

## 7. Future integration (not implemented)

1. **Bridge from `lib/fi/events/handlers`** — After successful ingest, build a `WorkflowEventContext` and `dispatch` (e.g. `eventName: 'fi.hli.intake.submitted'`, `entityType: 'case'`, `entityId: fiCaseId`).
2. **Bridge from CRM / bookings** — After mutations, dispatch domain events without duplicating business logic inside handlers.
3. **Persistence / outbox** — Append-only store + worker if cross-request reliability is required.
4. **Priorities or ordering** — Today concurrent; sequential or priority queues could be opt-in per registration.

---

## 8. Usage sketch

```typescript
import { workflowEngine, type WorkflowEventContext } from "@/src/lib/workflows";

const off = workflowEngine.register({
  id: "audit.log.booking_completed",
  eventName: "booking.completed",
  entityType: "booking",
  handler: async (ctx) => {
    // …
    return { ok: true, code: "logged" };
  },
});

await workflowEngine.dispatch({
  eventName: "booking.completed",
  entityType: "booking",
  entityId: bookingId,
  tenantId,
  payload: { source: "bookings.ts" },
});

off();
```

---

## 9. Related documents

- [03-event-ingestion-design](./03-event-ingestion-design.md) — External producer `fi_events` pipeline.
- [docs/audits/fi-workflow-events-audit.md](../audits/fi-workflow-events-audit.md) — Inventory of existing events and side effects.
