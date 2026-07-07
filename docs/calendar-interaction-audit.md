# CalendarOS Interaction Audit — FI-CALENDAR-INTERACTION-AUDIT-1

**Date:** 2026-07-07  
**Scope:** CalendarOS day/week views, quick-create, appointment drawer, drag/drop, server actions, permissions, audit trail, sync metadata.

## Executive summary

CalendarOS V2 now supports **click-to-create**, **appointment drawer**, and **drag-and-drop reschedule** on day view (intraday + staff/room column reassignment) and week/3-day views (cross-day moves preserving clock time). Imported **Google Calendar** events remain **read-only**. **Timely** webhook bookings can be rescheduled in FI OS with explicit confirmation and local-override metadata; no two-way Timely/Google write-back is implemented or claimed.

---

## Part A — Click-to-create

| Check | Status | Notes |
|-------|--------|-------|
| Empty slot opens create drawer | ✅ | Day: Y-position snap via `resolveCalendarEmptySlotClick`. Week/3-day: clinic open hour default. |
| Date/time prefilled | ✅ | `CalendarQuickCreateDrawer` + `calendarQuickCreateBookingAction` |
| Staff/room/clinic column prefilled | ✅ | `columnPrefillAssignment`, e2e covered |
| Appointment types (Consultation, PRP, Exosomes, Follow-up, Surgery, Blocker) | ✅ | Templates in `calendarQuickCreateTemplates.ts`; right-click context menu on day view (legacy + V2) |
| Patient/lead search | ✅ | Existing CRM search in quick-create drawer |
| Create without patient | ⚠️ | Consultation-only on unconverted leads; **Blocker** uses `other` type — still requires CRM anchor (operational workaround: internal placeholder lead) |
| Required fields clear | ✅ | Drawer validation + Zod on server action |
| Working-hours / overlap guards | ✅ | `createBooking` + conflict preview in drawer |
| Server-side permission gates | ✅ | `assertCrmTenantWriteAllowed` + `staffPinFloorAction: calendar.quick_book` |
| Revalidation after create | ✅ | `upsertBooking` + `router.refresh` via hook |
| Immediate calendar update | ✅ | Optimistic upsert without hard refresh |

**Fixes applied:** V2 day view context menu (right-click template picker); **Blocker** quick template; empty-slot hover affordance (`cursor-cell`, subtle highlight).

---

## Part B — Appointment click / edit

| Check | Status | Notes |
|-------|--------|-------|
| Click opens correct detail | ✅ | `BookingCalendarDrawer` |
| Patient name visible | ✅ | Header + card model prioritises person name |
| Appointment type visible | ✅ | Type label + badges |
| Source visible | ✅ | Drawer + V2 cards show Google / Timely / FI OS |
| Role-limited edits | ✅ | `canMutateBookings` gates actions |
| Read-only users blocked | ✅ | Loader gate + UI disables mutations |
| External appointments not silently overwritten | ✅ | Google read-only; Timely gets local-override metadata |
| Save does not duplicate | ✅ | `updateBooking` by id |
| Revalidation after save | ✅ | `onChanged` → refresh |

**Fixes applied:** Source labels on V2 cards; Timely local-override banner in drawer.

---

## Part C — Drag-and-drop rescheduling

| View | DnD | Behaviour |
|------|-----|-----------|
| **V2 Day** | ✅ | Same-day time change; staff/room column reassignment |
| **V2 Week / 3-day** | ✅ | Cross-day move; preserves duration + clock time; column reassignment |
| **V2 Month** | ✅ (legacy) | Falls through to legacy `MonthView` with `@dnd-kit` |
| **Legacy day/week/3-day** | ✅ | Unchanged `WeekView` when V2 off |

| Rule | Status |
|------|--------|
| Tenant permissions | ✅ `canMutateBookings` |
| Read-only mode | ✅ Drag disabled + server rejects |
| Overlap / staff hours | ✅ Client pre-check + `assertSlotAvailable` on PATCH |
| Google imported events | ✅ Drag disabled; PATCH returns error |
| Timely imported events | ✅ Confirm dialog + `rescheduled_in_fi_os` metadata |
| Failed drag rollback | ✅ Optimistic patch reverted on API failure |
| Toast feedback | ✅ Success/error toasts |

**Not implemented (documented):** Two-way Google/Timely write-back. Week view DnD does not change intraday time (week cells are day-level, not time-grid).

---

## Part D — Server action safety

| Mutation | Tenant resolve | Permission | Ownership | Overlap | Audit | Revalidate |
|----------|----------------|------------|-----------|---------|-------|------------|
| Quick create | ✅ route tenant | ✅ CRM gate + PIN | ✅ clinic/staff | ✅ createBooking | CRM activity on lead | ✅ |
| Update / cancel / complete | ✅ | ✅ | ✅ | ✅ | CRM activity | ✅ |
| Reschedule (PATCH) | ✅ | ✅ | ✅ | ✅ | CRM activity | ✅ |
| Google calendar_os_event | — | — | — | — | N/A | Blocked |

**Gap (unchanged):** No dedicated `fi_booking_audit_log` table — CRM activity on linked leads only.

---

## Part E — Visual UX

| Item | Status |
|------|--------|
| Empty slots look clickable | ✅ `cursor-cell` + hover tint |
| Draggable affordance | ✅ `cursor-grab` on mutable cards |
| Read-only drag disabled | ✅ |
| Patient name first on cards | ✅ |
| Surgery styling only for surgery | ✅ (existing card model tests) |
| External source on cards | ✅ Added |

---

## Part F — Tests

| Test file | Coverage |
|-----------|----------|
| `calendarEmptySlotClick.test.ts` | Slot snap math |
| `calendarOsBookingInteractionCore.test.ts` | Drag policy, Timely metadata, week plan |
| `calendarBookingCardModel.test.ts` | Card display |
| `appointmentsApiClient.test.ts` | Reschedule client |
| `e2e/calendar-os-v2-clinic-day.spec.ts` | Browser click-to-create |

Run unit tests:

```bash
node --import tsx --test src/lib/calendar-os/calendarOsBookingInteractionCore.test.ts src/lib/calendar-os/calendarBookingCardModel.test.ts src/lib/calendar/calendarEmptySlotClick.test.ts
```

---

## Manual smoke checklist

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | Create consultation from empty day slot | Quick book opens, consultation selected | _Run in staging_ |
| 2 | Create PRP from empty slot | Template / type PRP | _Run in staging_ |
| 3 | Create blocker (right-click menu) | Blocker template, `other` type | _Run in staging_ |
| 4 | Click appointment → edit notes | Drawer opens, save works | _Run in staging_ |
| 5 | Drag consultation later same day | Time updates, toast | _Run in staging_ |
| 6 | Drag consultation to next day (week view) | Date updates, duration kept | _Run in staging_ |
| 7 | Drag as read-only user | No drag handle / server 403 | _Run in staging_ |
| 8 | Overlapping drag | Rejected, card snaps back | _Run in staging_ |
| 9 | Drag Timely import | Confirm dialog + local override badge | _Run in staging_ |
| 10 | Calendar refreshes without hard reload | Optimistic + refresh | _Run in staging_ |

---

## Key files

- `components/calendar/CalendarPage.tsx` — orchestration
- `src/components/calendar-os/CalendarOsShell.tsx` — V2 shell + drag layer
- `src/components/calendar-os/CalendarOsDragLayer.tsx` — DnD context
- `src/lib/calendar-os/calendarOsBookingInteractionCore.ts` — interaction policy
- `lib/actions/fi-calendar-quick-create-actions.ts` — quick create
- `src/lib/bookings/appointmentsApi.ts` — reschedule + Google read-only guard
- `hooks/useCalendarAppointments.ts` — optimistic reschedule + metadata merge

---

## Acceptance criteria

| Criterion | Met |
|-----------|-----|
| Click empty slot → quick create | ✅ |
| Created appointment appears immediately | ✅ |
| Click appointment → readable detail | ✅ |
| Drag/drop works safely or documented | ✅ (week: day-level only) |
| No false external write-back confidence | ✅ |
| Read-only users blocked | ✅ |
| No duplicate bookings | ✅ |
| No cross-tenant mutation | ✅ (existing gates) |
| Audit + revalidation present | ✅ (CRM activity; no new audit table) |
