# Module: CalendarOS

## Purpose

Central event orchestration infrastructure for clinic operations: operational calendar views, FI-native bookings mirror, Google Calendar bidirectional sync, staff-to-calendar linkage, sync health monitoring, and conflict/review queues. CalendarOS is the scheduling spine; ClinicOS surfaces consume it for day-to-day operations.

## Dependencies

- **Platform Core** — tenancy, RLS, staff/users
- **WorkforceOS** — staff availability, shift assignments
- **LeadFlow** — consultation booking triggers from converted leads
- **FinancialOS** — deposit-confirmed bookings (target)
- **PatientOS** — patient-linked appointments

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `calendar.event.created` | FI Event Bus | Registered (GC-10) |
| `calendar.event.updated` | FI Event Bus | **Current** (GC-10 reconciliation) |
| `calendar.event.cancelled` | FI Event Bus | **Current** (GC-10 reconciliation) |
| `calendar.sync.started` | FI Event Bus | **Current** (GC-10) |
| `calendar.sync.completed` | FI Event Bus | **Current** (GC-10) |
| `calendar.sync.failed` | FI Event Bus | **Current** (GC-10) |
| `calendar.webhook.received` | FI Event Bus | **Current** (GC-10) |
| `calendar.webhook.subscription.*` | FI Event Bus | **Current** (GC-10) |
| `calendar.reconciliation.conflict_detected` | FI Event Bus | **Current** (GC-10) |
| `calendar.review_item.created` | FI Event Bus | **Current** (GC-10) |
| `patient.consultation.booked` | CRM activity / target bus | Partial (`booking.created` in `fi_crm_activity_events`) |
| `patient.followup.created` | Target FI Event Bus | Planned |
| `surgery.booking.created` | CRM activity | Partial (`booking.created` with surgery service type) |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `lead.created` / `lead.converted` | LeadFlow | Pre-fill booking context |
| `payment.deposit.confirmed` | FinancialOS | Confirm hold / unlock surgery slot |
| `staff.roster.updated` | WorkforceOS | Refresh calendar columns, eligibility |
| Timely appointment webhook | External | Upsert `fi_bookings` via integration layer |

## Database Tables

- `fi_bookings` — operational appointments (shared with ClinicOS)
- `fi_calendar_integrations` — Google OAuth connections (encrypted tokens)
- `fi_calendar_events` — FI mirror of provider calendar events
- `fi_calendar_sync_health`, `fi_calendar_sync_runs` — GC-8 monitoring
- `fi_calendar_sync_review_queue` — GC-7 human review for conflicts
- `fi_staff_calendar_links` — GC-6 staff ↔ provider calendar mapping
- `fi_calendar_inbound_scopes` — GC-5 inbound sync calendar selection

**Platform Event Bus (GC-10, block `10xx`):** `fi_platform_events`, `fi_platform_event_subscribers`, `fi_platform_event_deliveries`

**Migration block:** `20xx` (calendar), `10xx` (event bus)

## External Integrations

- **Google Calendar API** — OAuth 2.0, push notifications (webhooks), incremental sync
- **Timely** — legacy appointment webhook (`/integrations/timely/appointment`)
- **OnboardingOS** — Google connector staging during tenant setup (`90xx`)

## Security Boundaries

- OAuth tokens stored encrypted; service_role writes only on `fi_calendar_integrations`.
- Tenant members SELECT calendar data for their tenant; no cross-tenant calendar reads.
- Google webhook endpoints validate tenant + integration binding before processing.
- Cron-driven sync (`googleCalendarSyncScheduler`) uses service role with tenant scoping.

## Ownership Rules

| Data | System of record |
|------|------------------|
| FI booking record | CalendarOS / ClinicOS (`fi_bookings`) |
| Google Calendar event | Google (mirrored in `fi_calendar_events`) |
| Sync state & health | CalendarOS |
| Staff calendar mapping | CalendarOS (`fi_staff_calendar_links`) |

**Rule:** FI OS never depends on Google as the sole source of truth; sync failures must degrade gracefully to FI-native bookings.

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| OAuth token expired / revoked | Sync stops; stale mirror | `fi_calendar_integrations.status`, token refresh + admin reconnect UI |
| Sync conflict (duplicate / overlap) | Divergent calendars | GC-7 review queue; `calendar.reconciliation.conflict_detected` (GC-10 event bus) |
| Google API rate limit | Delayed sync | Backoff in sync scheduler; `fi_calendar_sync_runs` observability |
| Webhook delivery failure | Missed incremental updates | Scheduled background sync (GC-8) |
| Staff link missing | Events not attributed to columns | GC-6 provider links admin; WorkforceOS roster cross-check |

## GC-10 — FI Event Bus integration

CalendarOS publishes operational events to the FI Platform Event Bus (`10xx` migrations). Publishing is **best-effort** — sync, webhook, and reconciliation paths wrap emissions in `publishFiEventBestEffort()` so event bus outages never block primary calendar operations.

**Emit points**

- `googleCalendarSync.server.ts` — sync started / completed / failed
- `googleCalendarWebhookSubscriptions.server.ts` — webhook received; subscription created / renewed / expired
- `googleCalendarReconciliation.server.ts` — event updated / cancelled; reconciliation conflict detected
- `googleCalendarSyncReview.server.ts` — review item created (GC-7 queue)

**Admin diagnostics**

The Google Calendar Monitoring card includes a collapsible **Platform Events** section (events in last 24h, pending/failed deliveries, last event, health badge). Data loaded via `loadFiEventBusHealthForTenant()`.

See [event-bus.md](./event-bus.md) for naming conventions, retry rules, subscriber model, and future module expansion.
