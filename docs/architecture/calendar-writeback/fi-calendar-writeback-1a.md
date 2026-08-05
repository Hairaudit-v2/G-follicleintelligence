# FI-CALENDAR-WRITEBACK-1A — Operational Calendar Write-Back

**Date:** 2026-08-05  
**Verdict target:** GREEN when native + google_linked_fios are managed in production FiOS with proven Google write-back.

## Objective

Convert CalendarOS from a read-only viewer into an operational calendar for clinic staff, while preserving safe source-of-truth and write-back rules.

## Event classification

| Classification | Meaning |
|---|---|
| `fios_native` | `fi_bookings` row (not CalendarOS mirror) |
| `google_linked_fios` | FI-owned `fi_calendar_events` with Google external id |
| `google_external_unlinked` | Inbound Google / imported mirror without FI ownership for editing |
| `calendaros_test` | Admin test-panel provenance — isolated |
| `blocked_or_unsupported` | Cannot safely edit / write back |

Classification is explicit on the DTO (`calendarEventClassification` + `metadata.calendar_event_classification`). Editability is **not** inferred from `externalEventId` alone.

## Edit permissions

| Class | Quick Edit | Drag | Google write-back | Notes |
|---|---|---|---|---|
| fios_native | Yes | Yes | N/A | Full FiOS appointment path |
| google_linked_fios | Yes | Yes (when write-back ready) | Yes | SoT + If-Match etag |
| google_external_unlinked | No direct edit | No | No | External badge; Open / Link / Convert |
| calendaros_test | No | No | No | Never directing staff to test panel |
| blocked_or_unsupported | No | No | No | Clear explanation |

## Capabilities

- `calendar.view`
- `appointment.edit`
- `appointment.reschedule`
- `appointment.assign_resources`
- `appointment.link_patient`
- `appointment.convert_external` (elevated)
- `calendar.google_writeback`
- `appointment.override_lock` (elevated)

Resolved via `resolveCalendarAppointmentCapabilities` — not admin-only gates.

## Canonical field source of truth (`google_linked_fios`)

See `src/lib/calendar/calendarFieldSourceOfTruth.ts`.

| Field | SoT | Write back |
|---|---|---|
| start/end | dual_reconcile | Yes |
| title / description / location | fios (mapped) | Yes |
| patient / staff / clinic / room id / status | fios_only | No |
| Google event id / FiOS ids | preserved | — |
| etag | dual_reconcile | If-Match on PATCH |

Success is never reported until Google PATCH succeeds and the local mirror is updated. Concurrent Google edits return HTTP 412 → UI conflict. Failures leave `writeback_status: pending|failed|conflict`.

## Production drawer actions

Never: “Edit in Google Calendar or the CalendarOS test panel.”

Instead (by classification): Quick Edit, Open full appointment, Open in Google Calendar, Link patient, Convert to FiOS appointment, or a genuine read-only explanation.

## Key modules

| Path | Role |
|---|---|
| `calendarEventClassification.ts` | Classification |
| `calendarEventEditPolicy.ts` | Drawer / drag affordances |
| `calendarAppointmentCapabilities.ts` | Capability keys |
| `calendarDropIntent.ts` | Canonical drop-intent resolver |
| `calendarOsWriteback.server.ts` | Write-back + audit |
| `calendarOsPatientLink.server.ts` | Audited patient link |
| `calendarOsConvertExternal.server.ts` | Convert without duplicate |
| `PATCH .../calendar/appointments/[eventId]` | Quick Edit / drag API |

## Runtime proof checklist

### A. Native FiOS appointment
- [ ] Click opens editable Quick Edit / full appointment
- [ ] Drag changes time — reload persists
- [ ] Drag to clinician column — reload persists
- [ ] Drop clinician-unassigned clears clinician only; clinic retained

### B. Google-linked FiOS appointment
- [ ] Click opens editable drawer
- [ ] Drag changes time — FiOS mirror updates
- [ ] Google Calendar event updates (same event id)
- [ ] Reload both systems agree
- [ ] Sync status visible

### C. External unlinked Google event
- [ ] External badge + distinct chrome; no grab cursor
- [ ] Open in Google Calendar works
- [ ] Link patient (confirmation required) audited
- [ ] Convert creates `fi_bookings` without duplicating the mirror card

### D. Patient linkage
- [ ] “Patient not linked” replaces “Unnamed patient”
- [ ] External title shown separately
- [ ] Link audited; reload retains patient

### E. Failure handling
- [ ] Google write-back failure → pending/conflict; no false success toast
- [ ] Concurrent edit (etag mismatch) surfaced

## Unit tests

```bash
node --import tsx --test src/lib/calendar/calendarWriteback1a.test.ts
```

## Verdict

| Condition | Verdict |
|---|---|
| Native + linked editable with proven write-back | **GREEN** |
| Native editable; linked still read-only | **AMBER** |
| Still directing staff to Google / test panel for routine management | **RED** |
