# FI Platform Event Bus

## Purpose

The FI Platform Event Bus is the internal operational event layer for Follicle Intelligence OS. It is **not** a generic notification system. It provides durable, tenant-scoped event storage, subscriber routing, delivery tracking, and retry semantics so OS modules can react to operational changes without tight coupling.

CalendarOS (GC-10) is the first major publisher. Future modules — LeadFlow, PatientOS, SurgeryOS, FinancialOS, WorkforceOS, AnalyticsOS, AuditOS, and AcademyOS — will publish and subscribe through the same infrastructure.

## Event naming convention

Events use dot-separated namespaced identifiers:

```
{module}.{entity}.{action}
```

Examples:

- `calendar.sync.completed`
- `calendar.reconciliation.conflict_detected`
- `lead.converted` (registered placeholder, not yet wired)

Each event has a monotonic **event version** in `fiEventRegistry.ts`. Bump the version when the payload contract changes incompatibly.

## Event lifecycle

1. **Publish** — Module calls `publishFiEvent()` (or `publishFiEventBestEffort()` for non-critical paths).
2. **Persist** — Row inserted into `fi_platform_events` with `processing_status = pending`.
3. **Fan-out** — Matching enabled subscribers create rows in `fi_platform_event_deliveries`.
4. **Process** — `processFiEventDeliveries()` dispatches to registered handlers.
5. **Terminal** — Parent event marked `processed` when all deliveries are `delivered` or `skipped`; `failed` when any delivery exhausts retries.

```
Publisher → fi_platform_events → fi_platform_event_deliveries → Handler → Target module
```

## Subscriber lifecycle

Subscribers are defined in `fi_platform_event_subscribers`:

| Field | Meaning |
|-------|---------|
| `tenant_id` | `null` = global subscriber; otherwise tenant-specific |
| `source_module` | Optional filter on publisher module (e.g. `calendar_os`) |
| `event_name` | Exact event match |
| `handler_key` | Maps to `fiEventHandlers.server.ts` |
| `retry_limit` | Max delivery attempts before `failed` |

GC-10 seeds global CalendarOS subscribers for AnalyticsOS bridging, conflict notifications, and audit webhook enrichment.

## Retry rules

- Exponential backoff starting at 30 seconds: `30s × 2^(attempt-1)`, capped at 1 hour.
- Delivery `attempt_count` increments on each handler invocation.
- When `attempt_count >= retry_limit`, delivery status becomes `failed` and the parent event may become `failed`.
- `retryFailedFiEventDeliveries()` re-processes failed rows whose `next_attempt_at` has elapsed.

## Tenant isolation

- Every event and delivery row carries `tenant_id`.
- RLS allows authenticated tenant members to **SELECT** their tenant's rows only.
- All writes use the **service role** from trusted Next.js server code.
- Handlers receive `tenantId` and must scope downstream operations accordingly.
- Global subscribers (`tenant_id IS NULL`) still deliver per-tenant events; handler logic must never cross tenants.

## Idempotency

Pass `metadata.idempotencyKey` when publishing. Duplicate `(tenant_id, event_name, idempotencyKey)` inserts are suppressed via a partial unique index.

## CalendarOS events currently emitted (GC-10)

| Event | Trigger |
|-------|---------|
| `calendar.sync.started` | Manual / scheduled / webhook sync run begins |
| `calendar.sync.completed` | Sync run succeeds |
| `calendar.sync.failed` | Sync run fails |
| `calendar.webhook.received` | Google push notification processed |
| `calendar.webhook.subscription.created` | Webhook watch created |
| `calendar.webhook.subscription.renewed` | Webhook watch renewed |
| `calendar.webhook.subscription.expired` | Webhook watch expired |
| `calendar.event.updated` | Reconciliation updates local mirror |
| `calendar.event.cancelled` | Reconciliation detects cancelled external event |
| `calendar.reconciliation.conflict_detected` | Conflict staged for admin review |
| `calendar.review_item.created` | GC-7 review queue item created |

Event bus failures are **best-effort** — they never break calendar sync or webhook processing.

## Initial handlers (non-destructive)

| Handler | Behavior |
|---------|----------|
| `analytics.calendarEventCaptured` | Bridges to AnalyticsOS via `publishAnalyticsEvent` (`clinic_os` module) |
| `notifications.calendarConflictDetected` | Idempotent FI Admin notification for reconciliation conflicts |
| `audit.calendarWebhookReceived` | Structured log + optional reconciliation log enrichment |

No payments, patient messaging, surgery bookings, or clinical mutations are performed by GC-10 handlers.

## Future module expansion

Registered placeholder events (not yet wired):

- `lead.created`, `lead.converted`
- `patient.created`, `consultation.booked`
- `payment.received`
- `surgery.booked`, `surgery.completed`
- `staff.readiness.updated`
- `audit.completed`

Expansion pattern:

1. Add event + version to `fiEventRegistry.ts`
2. Seed subscribers in a Platform Core `10xx` migration
3. Implement handler in `fiEventHandlers.server.ts` (start read-only / analytics)
4. Publish from source module via `publishFiEventBestEffort()`
5. Add monitoring in module admin diagnostics

## Key files

| File | Role |
|------|------|
| `src/lib/events/fiEventRegistry.ts` | Canonical event names and versions |
| `src/lib/events/fiEventPublisher.server.ts` | Publish + idempotency + fan-out |
| `src/lib/events/fiEventProcessor.server.ts` | Delivery processing and retries |
| `src/lib/events/fiEventHandlers.server.ts` | Handler dispatch map |
| `src/lib/events/fiCalendarEventBus.server.ts` | CalendarOS best-effort emit helpers |
| `src/lib/events/fiEventBusHealth.server.ts` | Tenant health summary loader |

## Database tables (migration block `10xx`)

- `fi_platform_events`
- `fi_platform_event_subscribers`
- `fi_platform_event_deliveries`
