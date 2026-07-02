# Module: SurgeryOS

## Purpose

Surgical layer for hair restoration: case planning, procedure day workflow, live graft intelligence, clinical safety guardrails, and post-operative tracking. SurgeryOS connects consultation plans to operative outcomes and feeds AuditOS / Clinical Intelligence Network.

## Dependencies

- **PatientOS** — cases, patients, clinical scales
- **ConsultationOS** — surgery plans, candidacy
- **ImagingOS** — pre-op photography, donor/recipient intelligence (HIE stages)
- **CalendarOS** — surgery day bookings
- **WorkforceOS** — surgical team assignments
- **FinancialOS** — procedure economics, clearance
- **AuditOS** — outcome measurement

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `surgery.booked` | CRM activity / target bus | Partial (`booking.created`) |
| `surgery.completed` | Target FI Event Bus | Planned |
| `graft.harvested` | `fi_surgery_graft_count_events` / target bus | Partial |
| `patient.checkin.completed` | Target FI Event Bus | Planned |
| `procedure.cancelled` | Target FI Event Bus | Planned |
| Graft count increments | SurgeryOS tables | Current (Phase 2) |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `payment.deposit.confirmed` / financial clearance | FinancialOS | Unlock procedure day |
| `consultation.completed` | ConsultationOS | Seed surgery plan |
| `staff.roster.updated` | WorkforceOS | Team assignment validation |
| `calendar.event.updated` | CalendarOS | Surgery slot changes |

## Database Tables

- `fi_surgeries`, `fi_case_surgery_plans`, `fi_case_procedures`
- `fi_surgery_graft_sessions`, `fi_surgery_graft_count_events`
- `fi_surgery_os_graft_clinical_safety` — safety rules / alerts
- `fi_case_post_op_tracking`
- HIE donor/recipient intelligence tables (cross-module clinical intelligence)

**Migration block:** `60xx`

## External Integrations

- **HairAudit** — audit case evidence via `hairaudit.images.uploaded` ingest (outcome path)
- **FinancialOS** — surgery economics engine (phase 2 migrations)

## Security Boundaries

- Graft session writes: service role + authenticated surgical roles only.
- Live count events: append-only audit on `fi_surgery_graft_count_events`.
- Clinical safety rules: tenant-scoped; no cross-clinic graft data leakage.

## Ownership Rules

| Data | System of record |
|------|------------------|
| Surgery record | SurgeryOS (`fi_surgeries`) |
| Live graft totals | SurgeryOS (session + count events) |
| Surgery plan | SurgeryOS / ConsultationOS (`fi_case_surgery_plans`) |
| HairAudit audit case | HairAudit (FI ingests events) |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Graft reconciliation mismatch | Incorrect implanted count | `reconciliation_status` on sessions; staff review UI |
| Safety rule breach | Procedure should not proceed | Clinical safety migration alerts |
| Missing financial clearance | Unauthorized procedure start | FinancialOS clearance engine integration |
| Booking / surgery unlink | Orphan procedure day | `caseProcedureDayLinkedBooking` resolution |
