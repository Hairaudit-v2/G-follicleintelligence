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
| `calendar.event.created` | Target FI Event Bus | Planned |
| `calendar.event.updated` | Target FI Event Bus | Planned |
| `calendar.sync.failed` | Target FI Event Bus | Planned |
| `calendar.conflict.detected` | Target FI Event Bus | Planned |
| `calendar.webhook.received` | Target FI Event Bus | Planned |
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

**Migration block:** `20xx`

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
| Sync conflict (duplicate / overlap) | Divergent calendars | GC-7 review queue; `calendar.conflict.detected` (target) |
| Google API rate limit | Delayed sync | Backoff in sync scheduler; `fi_calendar_sync_runs` observability |
| Webhook delivery failure | Missed incremental updates | Scheduled background sync (GC-8) |
| Staff link missing | Events not attributed to columns | GC-6 provider links admin; WorkforceOS roster cross-check |
