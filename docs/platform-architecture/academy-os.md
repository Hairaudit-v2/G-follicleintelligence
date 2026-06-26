# Module: AcademyOS

## Purpose

Training, certification, and competency layer: projects IIOHR Academy exports into FI OS for operational readiness checks, procedure privileges, and staff certification status. AcademyOS is not the educational system of record — IIOHR remains SoR for courses and credentials.

## Dependencies

- **WorkforceOS** — staff records, assignments
- **SurgeryOS** — procedure privilege enforcement
- **AuditOS** — quality ↔ training feedback loop
- **Platform Core** — tenancy, staff linkage

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `training.completed` | Target FI Event Bus | Planned |
| `competency.approved` | Target FI Event Bus | Planned |
| `certification.expired` | Target FI Event Bus | Planned |
| `staff.readiness.updated` | Target FI Event Bus | Planned |
| Competency import | `fi_competency_import_events` | Current |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| IIOHR competency export | IIOHR / Academy | Upsert `fi_staff_competency_projections` |
| HR staff sync | IIOHR cron | Staff directory alignment |
| `audit.concern.detected` | AuditOS | Training remediation triggers (target) |
| `surgery.booked` | SurgeryOS | Privilege check before assignment |

## Database Tables

- `fi_staff_competency_projections`
- `fi_competency_import_events`
- `fi_procedure_privileges` — AcademyOS procedure privilege rules
- Cross-ref: `fi_staff`, `fi_staff_source_ids` (IIOHR IDs)

**Migration block:** `80xx`

## External Integrations

- **IIOHR / Academy** — competency export webhooks / batch import
- **HR staff sync cron** — `app/api/cron/iiohr-hr-perth-staff-sync`

## Security Boundaries

- Competency data: sanitized projections only (no full course content in FI).
- Import events: append-only audit; service_role writes.
- Procedure privilege checks: enforced at surgery assignment time (server-side).

## Ownership Rules

| Data | System of record |
|------|------------------|
| Courses, exams, certificates | IIOHR Academy |
| Operational competency projection | AcademyOS (`fi_staff_competency_projections`) |
| Procedure privileges (FI enforcement) | AcademyOS |
| Staff identity | WorkforceOS / Platform Core |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Stale competency export | Staff appears qualified when not | `expires_at`, `last_verified_at` + expiry events |
| IIOHR sync failure | Staff directory drift | Cron monitoring; manual re-sync runbook |
| Privilege rule gap | Unauthorized procedure role | Procedure privilege migration + assignment guards |
| Import parse error | Missing competency row | `fi_competency_import_events` error retention |
