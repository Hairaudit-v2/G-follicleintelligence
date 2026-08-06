# FI-CALENDAR-CONVERSION-UX-1C — Staff affinity, room loading, live acceptance

**Date:** 2026-08-06  
**Branch:** `cursor/external-event-conversion-ux`  
**Tenant:** Evolved Perth `c2615b95-b707-4485-aa5f-be8f78ec868a`

## Code delivery

| Item | Status |
|------|--------|
| Staff picker DTO `primary_clinic_id` + `clinic_ids` from `working_hours._profile` | Done — `loadCrmShellStaffPickerOptions` |
| Compatibility states (compatible / multi-clinic / different primary / no relationship / inactive) | Done — `externalEventConversionUx.ts` |
| Sole-clinic null affinity treated as compatible | Done (Evolved Perth has one clinic) |
| Rooms wired `CalendarPage.data.rooms` → Quick Edit → wizard | Done |
| Appointment-type resource policy (surgery required / consult optional; service requirements preferred) | Done — `conversionAppointmentResourcePolicy.ts` |
| Review shows patient, clinic, staff, room, warnings | Done |
| Convert persists `clinicId` / `assignedStaffId` / `roomId` + audit metadata | Done (1B + roomId) |
| Unit tests 1B + 1C | Passing (33 tests) — reconfirmed 2026-08-06 follow-up via `tsx --test` on `calendarConversionUx1b` + `1c` |

## Live DB evidence (2026-08-06)

Michael Buckland Google event (pre-conversion):

| Field | Value |
|-------|--------|
| Calendar event id | `2c4f1ab5-66f6-4544-8a86-391b735b39df` |
| Google `external_event_id` | `30sjurfcral48gvjnbs5ff80k4` |
| Title | Michael Buckland |
| Location (Google free text) | South Perth Evolved Surgery |
| Start / end (UTC) | 2026-08-05 02:00–02:15 |
| `patient_id` | null |
| `fios_appointment_id` | null |

Canonical clinic suggestion target:

| Field | Value |
|-------|--------|
| FiOS clinic | Evolved Perth |
| `clinicId` | `1c237ee8-3b71-440c-b09a-de2178fdd30d` |

Active rooms for Evolved Perth (6): Consult Room 1/2, Patient Room 1, PRP Room 1, Surgery Room 1/2.

Staff: 17 active rows; **none** currently have `working_hours._profile.primary_clinic_id` populated. Sole-clinic compatibility applies until profiles are filled.

## Live UI acceptance

**Blocked (original + 2026-08-06 follow-up):** Cursor IDE browser MCP cannot hold a stable automation tab. Exact sequence reconfirmed:

1. `browser_tabs` `list` → empty (`Open tabs:` with no entries).
2. `browser_tabs` `new` (also tried `position: "active"`) → returns `viewId` (e.g. `d53654`, `d44eea`) + `about:blank`.
3. Immediate `browser_navigate` with that `viewId` → `Browser view not found: <id>. Use browser_navigate without a viewId to create a new tab.`
4. `browser_navigate` without `viewId` / with `newTab: true` / with `position: "active"` → `No browser tab available. Please navigate to a page first.`
5. `browser_tabs` `list` after create → empty again (tab evaporates).

Operator was confirmed signed in when needed, but automation never reached the calendar page, so Michael Buckland wizard create/reload/no-duplicate could not run. **Note:** 1C code remains uncommitted/unpushed on `cursor/external-event-conversion-ux`; production `follicleintelligence.ai` would not show this branch until deployed — local/preview deploy is required for full live UX proof even after browser MCP is fixed.

**Manual replay path (post-deploy of this branch):**

1. Open `/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/calendar?date=2026-08-05`
2. Open **Michael Buckland** → **Convert to FiOS**
3. Patient step → create/link → Continue
4. Confirm **Evolved Perth** (suggested from South Perth Evolved Surgery)
5. Staff: Assign later **or** select e.g. Paul Green; pick **Consult Room 1** if available
6. Review → **Create FiOS appointment**
7. Reload calendar / reopen event → expect `google_linked_fios`, same Google event id `30sjurfcral48gvjnbs5ff80k4`, persisted clinic/staff/room
8. Repeat open → **Already linked to FiOS**; no duplicate patient/appointment

## Verdict

**AMBER** — Staff affinity + room loading + resource policy + unit tests (33 pass) are operational in the working tree. Live Michael Buckland create/reload/no-duplicate UI pass remains blocked by cursor-ide-browser MCP tab lifecycle deadlock (create → orphaned `viewId` → navigate refuses). DB preconditions for the fixture were confirmed in the prior session; not re-mutated here.
