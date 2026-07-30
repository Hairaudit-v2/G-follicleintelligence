# FI Pilot Control Centre 1A.4 — OpenAPI supplement

Read-only staff APIs for the Controlled Pilot Control Centre.

**Base path:** `/api/pilot-control`  
**Auth:** Session cookie or Bearer token; tenant resolved from membership (`x-fi-tenant-id` / `tenantId` as verified hint only).  
**Machine register:** `docs/audits/fi-pilot-control-api-contracts.json`

## Endpoints

| Method | Path | Permission alias |
|--------|------|------------------|
| GET | `/programmes` | `pilot_control.programmes.read` |
| GET | `/overview?programmeId=` | `pilot_control.overview.read` |
| GET | `/patients?programmeId=&page=&pageSize=` | `pilot_control.patient_register.read` |
| GET | `/patients/{patientId}?programmeId=` | `pilot_control.patient_detail.read` |
| GET | `/blockers?programmeId=` | `pilot_control.blockers.read` |
| GET | `/activity?programmeId=` | `pilot_control.activity.read` |
| GET | `/health?programmeId=` | `pilot_control.health.read` |
| GET | `/export?programmeId=&type=&format=` | `pilot_control.export` |

## Envelope

Successful JSON responses use `{ data, meta }` or `{ data, pagination, meta }`.  
Errors use `{ error: { code, message, correlationId } }` (no stack traces / SQL).

## Limits

- Max page size: 100 (register requires page + pageSize)
- Activity date range: max 31 days
- Export row limit: 500; CSV formula injection neutralised
- Correlation: `x-correlation-id` / `x-request-id` or generated UUID

## Out of scope (1A.4)

UI, mutations, invites, Stripe, blocker resolution, pilot pause actions.
