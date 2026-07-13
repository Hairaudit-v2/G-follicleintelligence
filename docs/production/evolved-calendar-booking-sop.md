# Evolved — Calendar booking source-of-record SOP

**Blocker:** BLK-CAL-01  
**Scope:** Google Calendar staged import vs FI-native bookings  
**Status:** Operator SOP — adopt before unrestricted reception use

**Related**

- [Evolved production blockers](./evolved-production-blockers.md) — BLK-CAL-01
- [Operational validation](./evolved-operational-validation.md) — Calendar section
- [FI-PH1 remediation command centre](./fi-ph1-p0-p1-remediation-command-centre.md)

---

## 1. Source of truth

| System | Role for Evolved daily ops |
| ------ | -------------------------- |
| **FI bookings** (`fi_bookings`) | **Authoritative** for clinic schedule, front desk, surgery readiness, and money clearance windows |
| **Google Calendar** | Mirror / review queue — inbound events may be staged for operator review |
| **Timely** (if enabled) | Legacy import path only — not day-of SoR unless explicitly cut over |

**Rule:** Staff must not assume a Google Calendar event exists as an FI booking until a row exists in FI Calendar / `fi_bookings`.

---

## 2. Staged Google approve does not create FI bookings

When an operator approves a staged inbound Google event:

- Staging status updates in the connector audit trail
- Audit detail includes `no_fi_booking_created: true`
- **No automatic FI booking** is created

**Reception action after approve (if the appointment should run in FI):**

1. Open **Calendar** in FI Admin
2. Create the FI booking with correct patient, service, staff, and room
3. Link or note the external Google event ID in booking metadata when available
4. Confirm the appointment appears on **Front desk** and operational boards

---

## 3. Weekly sync health review

| Check | Owner | Cadence |
| ----- | ----- | ------- |
| Google sync health (`/settings/integrations` or monitoring dashboard) | Clinic admin / ops | Weekly |
| GC-7 sync review queue empty or triaged | Reception lead | Weekly |
| FI bookings for next 7 days have staff + room where required | Reception | Daily |

---

## 4. Staff training acknowledgement

| Staff name | Role | Date | Initials |
| ---------- | ---- | ---- | -------- |
| | Reception lead | | |
| | Clinic admin | | |

**Acknowledgement:** I understand Google staged approve is review-only; FI-native booking create is required for day-of clinic operations.

---

## 5. Revision history

| Date | Change |
| ---- | ------ |
| 2026-07-13 | Initial BLK-CAL-01 operator SOP for Evolved pilot |
