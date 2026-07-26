# FI-PATIENT-APP-1D — Patient Journey + Appointments

**Verdict: GREEN**

| Field | Value |
|-------|-------|
| Ticket | FI-PATIENT-APP-1D |
| Closed | 2026-07-27 |
| Production identity mutations | **None** |
| Schema / migrations | **None** |
| New journey database | **None** (reuse FiOS journey signals) |
| Appointment mutations | **None** (read-only; change-request deferred) |
| Mobile application | **Not implemented** |

Companion JSON: `evidence-fi-patient-app-1d-journey-appointments.json`

---

## Scope executed

1. `GET /api/patient/v1/journey` — patient-safe stage / steps / server-derived `nextAction`
2. `GET /api/patient/v1/appointments` — upcoming/past patient-safe DTOs
3. `GET /api/patient/v1/appointments/{appointmentId}` — ownership re-check before return
4. Dedicated appointment ownership wrapper (`assertOwnedAppointmentRow` + audited helpers)
5. Structured `patient_gateway_audit` journey/appointment events (no tokens / PHI / staff notes)
6. OpenAPI updated to **v1.0.3**
7. Fail-closed tests for journey + appointments; 1B/1C suites remain GREEN

## Reuse

| Domain | Source |
|--------|--------|
| Journey signals / state | `loadPatientJourneySignals`, `derivePatientJourneyStateFromSignals`, persisted override row |
| Appointments | `loadBookingsForPatient`, `loadBookingForTenant` |
| Identity | `requirePatientGatewayContext` (unchanged Bearer-only) |

## Security proofs

| Case | Result |
|------|--------|
| A Own journey | success |
| B–E Auth / unlinked / ambiguous | fail closed via 1B gate suite |
| F Foreign patientId | ignored; context patient used |
| G Wrong tenant | denied via gate |
| H Internal workflow fields | absent |
| I Deterministic journey | identical payloads |
| J nextAction | server-derived |
| K List own appointments | only owned rows |
| L Cross-patient appointment id | denied |
| M Wrong tenant appointment | denied |
| N Orphaned appointment | denied |
| O Client patientId | ignored / denied by ownership |
| P Staff notes | absent |
| Q Past/future split | deterministic instant compare |
| R Staff booking workflows | loaders unchanged |
| S `/patient/*` portal module | unchanged |
| T 1B gateway suite | GREEN |
| U 1C imaging suite | GREEN |
| V lint | pass |
| W typecheck | pass |

## Explicit non-changes

- No booking/reschedule mutations
- No second appointment system
- Staff ClinicOS `/api/tenants/**/bookings` untouched
- Existing `/patient/*` portal behaviour untouched
- No billing / messaging / mobile UI

## Deferred

- `POST /api/patient/v1/appointments/{appointmentId}/change-request` documented as future (501 / 1D.1+)

## Test evidence

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGatewayGateCore.test.ts \
  src/lib/patientPortal/patientGatewayGate.server.test.ts \
  src/lib/patientPortal/patientGatewayOwnershipCore.test.ts \
  src/lib/patientPortal/patientGatewayMeCore.test.ts \
  src/lib/patientPortal/patientGatewayImageSlots.test.ts \
  src/lib/patientPortal/patientGatewayUploadIntentCore.test.ts \
  src/lib/patientPortal/patientGatewayImagesCore.test.ts \
  src/lib/patientPortal/patientGatewayImages.server.test.ts \
  src/lib/patientPortal/patientGatewayJourneyCore.test.ts \
  src/lib/patientPortal/patientGatewayJourney.server.test.ts \
  src/lib/patientPortal/patientGatewayAppointmentsCore.test.ts \
  src/lib/patientPortal/patientGatewayAppointments.server.test.ts
```

Result: **68 passed / 0 failed** (2026-07-27).

Lint: `next lint` on 1D files — pass.  
Typecheck: `tsc --noEmit` — pass.
