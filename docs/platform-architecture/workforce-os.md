# Module: WorkforceOS

## Purpose

Staff operations layer: directory, rostering, shifts, availability blocks, clinical staffing templates, event assignments, feature access, and HR sync from IIOHR. WorkforceOS feeds CalendarOS columns and SurgeryOS team assignment.

## Dependencies

- **Platform Core** — tenants, users, clinics
- **AcademyOS** — competency / readiness projections
- **CalendarOS** — schedulable staff visibility
- **ClinicOS** — services eligibility
- **SurgeryOS** — surgical team assignments

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `staff.roster.updated` | Target FI Event Bus | Planned |
| `staff.shift.assigned` | Target FI Event Bus | Planned |
| `staff.availability.changed` | Target FI Event Bus | Planned |
| Staff sync completion | `fi_staff_sync_runs` | Current |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| IIOHR HR staff sync | IIOHR cron | Upsert `fi_staff`, source IDs |
| `training.completed` / `certification.expired` | AcademyOS | Availability / privilege flags |
| `calendar.event.created` | CalendarOS | `fi_staff_event_assignments` linkage |

## Database Tables

- `fi_staff`, `fi_staff_source_ids`, `fi_staff_pins`
- `fi_staff_members`, `fi_staff_login_invitations` (Staff Access Centre)
- `fi_staff_availability_blocks`, `fi_staff_shifts`
- `fi_clinical_staffing_templates`, `fi_staff_event_assignments`
- `fi_staff_feature_access`, `fi_staff_feature_access_audit_events`
- `fi_staff_sync_runs`, `fi_staff_intelligence_*` (stage 375)
- `fi_service_staff_eligibility` (shared with ClinicOS)

**Migration block:** `50xx`

## External Integrations

- **IIOHR** — HR staff sync webhook/cron (`iiohr-hr-perth-staff-sync`)
- **Timely** — legacy staff mapping via source IDs (where used)

## Security Boundaries

- Staff PII: tenant RLS; feature access changes audited append-only.
- PIN/kiosk flows: separate reception board auth path.
- Cross-clinic staff: explicit `clinic_id` on shifts/blocks.

## Ownership Rules

| Data | System of record |
|------|------------------|
| HR master record | IIOHR |
| FI staff operational projection | WorkforceOS (`fi_staff`) |
| Shift / availability | WorkforceOS |
| Auth user linkage | Platform Core (`fi_users` ↔ `fi_staff`) |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| HR sync partial failure | Stale staff directory | `fi_staff_sync_runs` status + rerun |
| Double booking staff | Calendar conflict | Availability blocks + CalendarOS overlap checks |
| Feature access drift | Wrong module visibility | Audit events on access changes |
| Unlinked fi_user | Staff not schedulable | Admin linking UI in staff directory; **Staff Access Centre** for login invites |

See also: [Staff Access Centre guide](../workforce/workforceos-staff-access-centre.md).
