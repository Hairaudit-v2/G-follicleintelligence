# Module: LeadFlow

## Purpose

Acquisition and pipeline engine: capture enquiries from HubSpot, Meta, and direct channels; score and stage leads; drive conversion to CRM persons, cases, and consultation bookings. LeadFlow is the top of the revenue funnel for FI OS clinics.

## Dependencies

- **Platform Core** — tenancy, users
- **ClinicOS / CalendarOS** — consultation booking on conversion
- **FinancialOS** — deposit requests post-quote
- **AnalyticsOS** — funnel metrics ingestion

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `lead.created` | CRM activity (`fi_crm_activity_events`) | Current |
| `lead.updated` | CRM activity | Current |
| `lead.converted` | CRM activity (`lead.converted_to_person`, `lead.case_seeded`) | Current |
| `consultation.booked` | CRM activity (`booking.created`) | Current |
| `deposit.requested` | Target FI Event Bus | Planned |
| `lead.scored` | `fi_lead_activity` / target bus | Partial (LF-3 scoring) |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| HubSpot contact / deal webhooks | HubSpot | `fi_external_events` → processor queue |
| Meta lead ads (future) | Meta | `fi_external_events` |
| `booking.completed` | CalendarOS | Stage advancement, post-consult reminders |
| `payment.deposit.confirmed` | FinancialOS | Pipeline stage unlock |

## Database Tables

**CRM foundation (legacy, still active)**

- `fi_crm_leads`, `fi_crm_pipeline_stages`, `fi_crm_lead_stage_history`
- `fi_crm_activity_events`, `fi_crm_tasks`, `fi_crm_notes`, `fi_crm_messages`
- `fi_crm_quotes`, `fi_crm_quote_templates`, `fi_crm_lead_source_ids`

**LeadFlow-native (LF-1+)**

- `fi_leads` — LeadFlow anchor (parallel to CRM during migration)
- `fi_lead_activity` — append-only lead audit ledger
- `fi_external_events` — inbound provider events (HubSpot, Meta)
- `fi_lead_scoring_rules` — LF-3 scoring configuration

**Import**

- `fi_import_batches`, `stg_hubspot_contacts_imports`

**Migration block:** `30xx`

## External Integrations

- **HubSpot** — webhooks, import centre, connector (`90xx` onboarding phase F4)
- **Meta Lead Ads** — planned via `fi_external_events`
- **Resend / Twilio** — reminder delivery (via reminder engine on `lead_created` trigger)

## Security Boundaries

- HubSpot webhooks: tenant-scoped secrets, idempotency on `fi_external_events (tenant_id, provider, external_id)`.
- CRM activity API accepts custom `activityKind` strings (1–128 chars) — integrators must not bypass tenant gates.
- Lead PII: tenant RLS; no cross-tenant lead reads.
- Queue drain cron processes `fi_external_events` with service role only.

## Ownership Rules

| Data | System of record |
|------|------------------|
| Lead record (CRM) | LeadFlow (`fi_crm_leads`) |
| Lead record (native) | LeadFlow (`fi_leads`) — converging with CRM |
| HubSpot contact | HubSpot (FI stores mapping + projection) |
| Pipeline stage history | LeadFlow (append-only) |
| Converted person / case | PatientOS / Platform Core after conversion |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| HubSpot webhook duplicate | Double processing | Idempotency index on `fi_external_events` |
| Queue drain backlog | Stale lead scores / stages | `leadFlowQueueHealth` diagnostics; cron monitoring |
| Conversion without person link | Orphan booking | `leadConversion.ts` atomic flow + CRM activity audit |
| HubSpot API rate limit | Import stall | Batched import centre; retry with batch status |
| Scoring rule misconfiguration | Wrong priority routing | LF-3 rule versioning; operator dashboard review |
