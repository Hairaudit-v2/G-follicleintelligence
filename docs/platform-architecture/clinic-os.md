# Module: ClinicOS

## Purpose

Daily clinic operations spine: services catalogue, room/staff eligibility, operational calendar UX, reception workflows, reminders, and front-desk closeout. ClinicOS orchestrates *how* the clinic runs; CalendarOS owns sync infrastructure; PatientOS owns the patient record.

## Dependencies

- **Platform Core** — tenants, clinics, users
- **CalendarOS** — bookings, calendar grid, Google sync display
- **WorkforceOS** — staff directory, schedulable resources
- **LeadFlow** — lead-linked bookings
- **PatientOS** — patient context on appointments
- **ConsultationOS** — post-consult workflows (cross-module)

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `booking.created` / `booking.updated` / `booking.cancelled` / `booking.completed` | CRM activity | Current |
| `appointment.instructions_sent` | CRM activity | Current |
| `reception.closeout.completed` | Target FI Event Bus | Planned |
| `service.catalog.updated` | Target FI Event Bus | Planned |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `lead.created` | LeadFlow | Reminder enqueue (`lead_created` trigger) |
| `staff.roster.updated` | WorkforceOS | Calendar column visibility |
| Timely patient webhook | External | Person/patient upsert |

## Database Tables

- `fi_services`, `fi_service_staff_eligibility`, `fi_service_room_eligibility`
- `fi_clinic_rooms` (seed migrations)
- `fi_bookings` — shared with CalendarOS
- `fi_reminder_templates`, `fi_reminder_jobs`
- `fi_reception_tasks`, `fi_reception_communication_deliveries`
- `fi_reception_daily_closeouts`, `fi_reception_daily_closeout_items`
- `fi_staff`, `fi_staff_pins`, `fi_staff_feature_access`

## External Integrations

- **Timely** — patient + appointment webhooks (legacy bridge)
- **Resend / Twilio** — appointment reminders (`FI_REMINDERS_LIVE_DELIVERY` gated)
- **Google Calendar** — via CalendarOS (display + quick-create)

## Security Boundaries

- Reception board PIN flows: staff PIN audit tables; limited surface for non-authenticated kiosk use.
- Reminder cron: `CRON_SECRET` + service role; no PII in logs.
- Booking mutations: server actions with tenant portal gate (`assertFiTenantPortalAccess`).

## Ownership Rules

| Data | System of record |
|------|------------------|
| Service definitions | ClinicOS (`fi_services`) |
| Booking operational state | ClinicOS / CalendarOS (`fi_bookings`) |
| Reminder jobs | ClinicOS |
| Reception closeout | ClinicOS |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Reminder cron failure | Missed SMS/email | `fi_reminder_jobs` retry + ops alert |
| Overbooking (overlap) | Double-booked resource | Exclusion constraints + overlap query (`fi_bookings_overlap`) |
| Timely webhook auth failure | Stale external appointments | Bearer secret rotation runbook |
| Room/staff eligibility mismatch | Invalid booking offer | Pre-create validation in `bookingResourceRequirements` |
