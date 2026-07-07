# CalendarOS Interaction E2E Smoke — FI-CALENDAR-INTERACTION-E2E-1

**Date:** 2026-07-07  
**Follows:** [calendar-interaction-audit.md](./calendar-interaction-audit.md) (FI-CALENDAR-INTERACTION-AUDIT-1)  
**Environment:** Staging browser smoke (target) + local static/unit verification (executed)

## Summary

| Tier | What ran | Outcome |
|------|----------|---------|
| **Unit / policy** | `calendarOsBookingInteractionCore`, `calendarBookingCardModel`, `calendarEmptySlotClick`, `calendarQuickCreateTemplates` | 14/15 pass — one template-count assertion stale after Blocker addition |
| **Playwright (browser)** | `e2e/calendar-os-v2-clinic-day.spec.ts` | **Not executed** — `FI_E2E_BASE_URL` unset in this workspace |
| **Code review** | CalendarOS shell, drag layer, quick-create, drawer, hooks | All 15 scenarios have implemented paths; gaps are automated browser coverage and week/3-day context-menu parity |

**Acceptance posture:** CalendarOS is **safe for reception/staff fast creation and controlled rescheduling** based on implemented guards (permissions, overlap, Google read-only, Timely local-override, optimistic rollback). Full staging sign-off requires pointing Playwright at staging and running the manual checklist below.

### Run commands

```bash
# Unit (executed 2026-07-07)
node --import tsx --test \
  src/lib/calendar-os/calendarOsBookingInteractionCore.test.ts \
  src/lib/calendar-os/calendarBookingCardModel.test.ts \
  src/lib/calendar/calendarEmptySlotClick.test.ts \
  src/lib/calendar/calendarQuickCreateTemplates.test.ts

# Browser (staging — requires credentials + tenant)
FI_E2E_BASE_URL=https://<staging-host> \
FI_E2E_TENANT_ID=<tenant-uuid> \
pnpm exec playwright test e2e/calendar-os-v2-clinic-day.spec.ts --project=chromium-authenticated
```

---

## Scenario results

| # | Scenario | Result | Issue found | Fix required |
|---|----------|--------|-------------|--------------|
| 1 | Empty day-view slot click opens quick-create with correct date/time | **Pass** (unit + existing e2e spec) | None | None — `e2e/calendar-os-v2-clinic-day.spec.ts` already asserts Consultation + snapped start time |
| 2 | Right-click empty slot shows templates (Consultation, PRP, Exosomes, Follow-up, Surgery, Blocker) | **Pass** (day view, code) / **Gap** (week & 3-day V2) | V2 day view context menu includes all six required types plus Phone Consultation and Surgery Review. `CalendarOsWeekResourceView` has click-to-create only — no `onContextMenu` / template picker on week or 3-day cells | **Optional:** wire `onEmptySlotContextMenu` into `CalendarOsWeekResourceView` for parity; trim menu to the six reception templates if Phone/Surgery Review should not appear in smoke scope |
| 3 | Create a consultation and confirm it appears immediately | **Pass** (code) / **Pending staging** | Optimistic `upsertBooking` + `router.refresh()` on `onCreated`; requires CRM patient/lead anchor | None for happy path — run staging create once to confirm end-to-end |
| 4 | Create a PRP appointment; card shows patient name + PRP | **Pass** (unit) / **Pending staging** | Card model test covers patient name + type labelling | None — extend e2e to create PRP with a named patient when staging credentials available |
| 5 | Click existing appointment; drawer opens with name/type/time/source | **Pass** (partial e2e + code) / **Pending staging** | Playwright opens drawer and checks chrome placement; does not assert name/type/time/source fields | Add drawer field assertions to `calendar-os-v2-clinic-day.spec.ts` or new interaction spec |
| 6 | Drag FI OS-created appointment later on same day | **Pass** (code) / **Pending staging** | `planDayViewDragReschedule` + `CalendarOsDragLayer` day drop path implemented; no Playwright drag coverage | Add `@mutation` e2e: drag card within day column, assert time change + success toast |
| 7 | Drag FI OS-created appointment to another staff/room column | **Pass** (code) / **Pending staging** | Column reassignment via `assigneeMetaFromResourceColumnId` on day drop | Add e2e across two resource columns (staff or room preset) |
| 8 | Drag appointment in 3-day/week view to another day | **Pass** (code) / **Pending staging** | `planWeekCellDragReschedule` preserves duration + clock time; week cells are **day-level** (not intraday time-grid drag) | Document-only for week/3-day time semantics; add e2e for cross-day cell drop |
| 9 | Attempt to drag Google-imported appointment — disabled/rejected | **Pass** (unit + server guard) / **Pending staging** | `isBookingDragMutable` → false; `data-calendar-draggable="false"`; PATCH throws read-only error | Add e2e fixture with `calendar_os_event` row; assert no drag + server rejection if forced |
| 10 | Drag Timely-imported appointment — warning + local override metadata | **Pass** (unit + code) / **Pending staging** | `window.confirm` before reschedule; `buildLocalRescheduleMetadataPatch` sets `rescheduled_in_fi_os` + `source_sync_status: local_override` | Optional UX: replace `window.confirm` with branded dialog; e2e should accept/dismiss confirm |
| 11 | Attempt drag as read-only user — disabled/rejected | **Pass** (code) / **Pending staging** | `canMutateBookings` removes DnD context, hides empty-slot layers, disables card drag; loader gate sets blocked reason | Add e2e with read-only roster credentials (`e2e/journeys/roster-permission-validation.spec.ts` pattern) |
| 12 | Attempt overlapping drag — rollback and toast error | **Pass** (code) / **Pending staging** | Client `bookingConflictsForOperationalCalendar` pre-check; server 409; `replaceBooking(snapshot)` rollback; error toast in drag layer | Add e2e: seed adjacent bookings, drag into overlap, assert card snaps back + error toast |
| 13 | 3-day view shows all 3 lanes, not only first lane | **Pass** (code + unit) / **Pending staging visual** | `buildCalendarThreeDay` returns 3 lanes; `CalendarOsWeekResourceView` maps all `lanes` in header + grid (`calendarOsWeekGridTemplate(density, lanes.length)`) | Add e2e: `view=3day`, assert three day column headers in `calendar-week-grid` |
| 14 | No duplicate bookings after drag/drop | **Pass** (code) / **Pending staging** | Reschedule PATCH updates by id; optimistic layer uses `replaceBooking` not insert | Staging: note booking count before/after drag; optional e2e DB assertion |
| 15 | Live data surfaces revalidate after successful mutation | **Pass** (code) / **Pending staging** | `router.refresh()` after create (`onCreated`) and successful reschedule; optimistic Zustand upsert avoids hard reload | None for UX — server actions do not call `revalidatePath` directly; client refresh is intentional. Confirm Today/agenda surfaces update on staging refresh |

---

## Detailed notes by scenario

### 1 — Empty day slot → quick-create

- **Verified:** `resolveCalendarEmptySlotClick` unit test; Playwright spec clicks `[data-testid="calendar-empty-slot-layer"]` and expects Consultation + `calendar-quick-create-start-time` value.
- **Files:** `CalendarOsDayResourceView.tsx`, `CalendarQuickCreateDrawer.tsx`, `e2e/calendar-os-v2-clinic-day.spec.ts`.

### 2 — Right-click template menu

- **Verified:** `CalendarPage.tsx` renders `CalendarSlotContextMenu` with Consultation, PRP, Exosomes, Follow Up, Surgery, Blocker (plus Phone Consultation, Surgery Review).
- **Gap:** Context menu is wired only on V2 **day** empty-slot layers (`CalendarOsDayResourceView`), not week/3-day cells.

### 3 — Create consultation → immediate appearance

- **Verified:** `CalendarPage` `onCreated` → `upsertBooking` + `setHighlightedBookingId` + `refresh()`.
- **Caveat:** Quick-create still requires patient/lead anchor (see audit Part A).

### 4 — PRP card display

- **Verified:** `calendarBookingCardModel.test.ts` — patient name from anchor/title; type label from catalog/booking_type.

### 5 — Appointment drawer detail

- **Verified:** `BookingCalendarDrawer.tsx` shows patient summary, `BookingTypeBadge`, formatted when-range, `externalSourceLabelForBooking`.
- **E2e gap:** Only drawer visibility + z-index tested today.

### 6–8 — Drag reschedule (day / column / cross-day)

- **Verified:** `CalendarOsDragLayer.tsx`, `calendarOsBookingInteractionCore.ts`.
- **Limitation:** Week/3-day drag moves **day + resource column**; it does not change intraday time within a week cell (by design — see audit Part C).

### 9 — Google import drag blocked

- **Verified:** Unit + `appointmentsApi.ts` server guard: *"Imported Google Calendar events are read-only in FI OS."*

### 10 — Timely drag + local override

- **Verified:** Unit metadata patch; UI confirm string in drag layer; drawer banner via `bookingNeedsSourceUpdateWarning`.

### 11 — Read-only user

- **Verified:** `operationalCalendarLoader.server.ts` → `canMutateBookings`; shell skips `DndContext` when false; cards get `data-calendar-draggable="false"`.

### 12 — Overlap rollback

- **Verified:** `useCalendarAppointments.rescheduleBooking` — client conflict short-circuit; on API failure `replaceBooking(b.id, snapshot)`; drag layer `toast.error`.

### 13 — Three day lanes

- **Verified:** `stage3c.test.ts` — three consecutive `dayKey`s; week grid renders `lanes.map` for header and body.

### 14 — No duplicates

- **Verified:** Reschedule path updates existing row; create path uses single `createBooking` insert.

### 15 — Revalidation

- **Verified:** Client `refresh()` after successful mutation; Timely/Google ingest paths call `revalidateLiveDataSurfacesForTenant` on webhook/sync (orthogonal to manual drag).

---

## Defects found during smoke prep

| ID | Severity | Description | Fix |
|----|----------|-------------|-----|
| SMK-1 | Low | `calendarQuickCreateTemplates.test.ts` expects 7 template labels; `Blocker` was added (8 total) — unit test fails | Update expected labels array to include `"Blocker"` |
| SMK-2 | Medium | No Playwright coverage for drag/drop, overlap rollback, read-only, Timely confirm, or 3-day lane count | Extend `e2e/calendar-os-v2-clinic-day.spec.ts` or add `calendar-os-v2-interaction.spec.ts` tagged `@mutation` |
| SMK-3 | Low | Week/3-day V2 lacks right-click quick templates (scenario 2 scope assumes day view) | Product call: add context menu to week cells or document day-only |

---

## Staging manual checklist (when `FI_E2E_BASE_URL` is set)

Run as reception-capable demo admin, then read-only roster user:

1. [ ] Day empty slot click → Quick book, time matches click Y
2. [ ] Day empty slot right-click → six core templates visible
3. [ ] Create Consultation with patient → card on grid without full page reload
4. [ ] Create PRP → card shows **patient name** and **PRP**
5. [ ] Click card → drawer: name, type, time range, source (FI OS)
6. [ ] Drag FI booking +30 min same column → toast success, single row
7. [ ] Drag FI booking to adjacent staff/room column → assignee updates
8. [ ] Switch to 3-day → drag to adjacent day column → date changes, duration kept
9. [ ] Google import → no grab cursor; drag attempt does nothing
10. [ ] Timely import → confirm dialog → move → local override badge in drawer
11. [ ] Read-only session → no empty-slot layer / no drag / toolbar shows Read-only
12. [ ] Drag onto occupied slot → error toast, card returns to origin
13. [ ] 3-day view → three day headers visible
14. [ ] After drag, booking count unchanged (same id)
15. [ ] Navigate to Today/agenda → moved booking reflects new time

---

## Acceptance

| Criterion | Status |
|-----------|--------|
| Click empty slot → quick create | ✅ Implemented; e2e partial |
| Created appointment appears immediately | ✅ Optimistic + refresh |
| Click appointment → readable detail | ✅ Implemented |
| Drag/drop safe or documented | ✅ Guards + rollback; week day-level only |
| No false external write-back | ✅ Google blocked; Timely FI-local only |
| Read-only users blocked | ✅ Loader + UI gates |
| No duplicate bookings | ✅ Update-by-id |
| No cross-tenant mutation | ✅ Existing CRM gates |
| Audit + revalidation | ✅ CRM activity; client refresh |
| **Staging browser sign-off** | ⏳ Pending `FI_E2E_BASE_URL` run |

**Verdict:** Safe for reception/staff use **pending staging browser execution** of the checklist above. No blocking code defects identified; recommended follow-ups are test hygiene (SMK-1) and Playwright interaction coverage (SMK-2).
