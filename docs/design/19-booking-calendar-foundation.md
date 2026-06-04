# Booking & calendar foundation (Stage 3A / 3B / 3C)

## Stage 3A — Booking foundation (implemented)

**Purpose:** introduce the first **platform-wide** booking table (`fi_bookings`) with tenant isolation, optional CRM lead linkage, and FI Admin API + server actions. CRM remains one consumer; bookings also support person/patient/case anchors without a lead.

### Data model

| Table | Notes |
|-------|--------|
| `fi_bookings` | See migration `20260610120001_fi_bookings.sql`: anchors (`lead_id`, `person_id`, `patient_id`, `case_id` — at least one required), scheduling fields, `booking_type` / `booking_status`, cancellation + audit columns, `metadata` jsonb object. |

**Constraints (DB):** valid type/status enumerations, `end_at > start_at`, `metadata` must be a JSON object, at least one anchor FK.

**RLS:** same pattern as CRM foundation — `authenticated` **SELECT** when `fi_users` row matches `tenant_id`; **INSERT/UPDATE/DELETE** for `service_role` only (FI Admin server path).

### HTTP routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenants/[tenantId]/bookings?start=&end=` | Overlapping bookings in `[start, end)` window (ISO timestamps). |
| POST | `/api/tenants/[tenantId]/bookings` | Create booking (gated). |
| PATCH | `/api/tenants/[tenantId]/bookings/[bookingId]` | Update non-cancelled booking; terminal statuses via dedicated routes. |
| POST | `/api/tenants/[tenantId]/bookings/[bookingId]/cancel` | Cancel + optional reason. |
| POST | `/api/tenants/[tenantId]/bookings/[bookingId]/complete` | Mark completed. |

Access control reuses **`assertCrmTenantReadAllowed` / `assertCrmTenantWriteAllowed`** (FI Admin key and/or CRM-capable tenant member role).

### Server actions

File: `lib/actions/fi-booking-actions.ts`

- `createBookingAction`
- `updateBookingAction`
- `cancelBookingAction`
- `completeBookingAction`

### Service helpers

Directory: `src/lib/bookings/`

| Module | Role |
|--------|------|
| `bookingPolicy.ts` | Pure allow-lists, anchor guard, time guard, cancelled immutability, consultation-only-before-conversion, metadata object guard, `isBookingRowForTenant`. |
| `bookingChangedFields.ts` | `changed_keys` for CRM activity on update. |
| `bookingTime.ts` | `sortBookingsByStartAt`, `isBookingUpcoming`. |
| `bookingApiSchemas.ts` | Zod request bodies / list query. |
| `bookings.ts` | Supabase mutations + loaders + tenant FK checks + CRM activity when `lead_id` is set; **`loadBookingsForOperatorView`** (Stage 3B) — tenant overlap + filters + ascending sort + row cap. |
| `server.ts` | `server-only` re-exports for routes/actions. |
| `operatorBookingConstants.ts` | Shared default / max row caps for the operator list (client-safe). |
| `operatorBookingQuery.ts` | Pure: default date range, search-param parsing, href builder, UTC day bounds for summaries. |
| `operatorBookingSummary.ts` | Pure: summary tile counts, cancelled visibility filter helper. |
| `operatorBookingLabels.ts` | Pure: staff-facing type/status labels for UI. |
| `bookingOperatorLoader.ts` | `loadBookingsOperatorPageData` — list + summary slice + tenant users + clinics. |

**CRM activity kinds** (only when `lead_id` present): `booking.created`, `booking.updated` (with `changed_keys`), `booking.cancelled`, `booking.completed`. Detail payload is IDs (+ `changed_keys` on update) only — no free-text PII.

### UI (Stage 3A)

Lead detail (`fi-admin/[tenantId]/crm/leads/[leadId]`):

- `LeadBookingPanel` — lists upcoming vs past/cancelled, optional FI Admin key, create/edit/cancel/complete.
- `BookingCreatePanel` / `BookingSummaryCard` — building blocks under `src/components/fi/bookings/`.

Loader: `loadCrmShellLeadBundle` now includes **`leadBookings`** via `loadBookingsForLead`.

### Tests

`src/lib/bookings/stage3a.test.ts` — pure policy / changed-field / sort coverage (run via `npm run test:unit`).

---

## Stage 3B — Booking operator UI (implemented)

**Purpose:** first **operational** bookings surface for CRM-capable FI Admin users: list, filter, quick-create, edit (non-cancelled), cancel, and complete — **without** a visual calendar.

### FI Admin route

| Path | Notes |
|------|--------|
| `/fi-admin/[tenantId]/bookings` | Gated with **`assertCrmShellPageAccess`** (same roles as CRM shell). Nav link **Bookings** appears next to **CRM** when that nav is allowed. |

### Loader

- **`loadBookingsOperatorPageData`** (`bookingOperatorLoader.ts`) returns:
  - **List rows:** `loadBookingsForOperatorView` over the selected window and filters (default **start of today (UTC)** through **exclusive end = start of today + 31 UTC days** so “today + 30 calendar days” are covered).
  - **Summary tiles:** a wider overlap window (≈ **120 days back** through **max(list end, tomorrow start)**), capped at **`MAX_OPERATOR_BOOKINGS_LIMIT` (2000)** rows, all statuses; pure **`computeOperatorBookingSummaryCounts`** for today / upcoming / overdue / cancelled / completed. If the cap is hit, the UI warns that counts may be incomplete.
  - **Pickers:** `loadCrmShellUserPickerOptions`, `loadCrmShellScopePickerOptions` (clinics from `fi_clinics` when present; free-text **location** still supported on rows).

### Query params (list)

| Param | Purpose |
|-------|---------|
| `start` | Range start (ISO or parseable datetime). |
| `end` | Range end (exclusive-style upper bound; same parsing as `start`). |
| `type` | `booking_type` filter (allow-listed). |
| `status` | `booking_status` filter (allow-listed). Selecting **`cancelled`** forces **`includeCancelled`**. |
| `assignedUserId` | UUID filter on `assigned_user_id`. |
| `clinicId` | UUID filter on `clinic_id`. |
| `includeCancelled` | `1` / `true` / `yes` — include cancelled rows in the list (default off). |

### Limits

- **Default list cap:** `DEFAULT_OPERATOR_BOOKINGS_LIMIT` (**500**) rows per query; **`listTruncated`** surfaces when the cap is reached.
- **Hard max:** `MAX_OPERATOR_BOOKINGS_LIMIT` (**2000**) for any operator query (including the summary slice).

### UI components (`src/components/fi/bookings/operator/`)

| Component | Role |
|-----------|------|
| `BookingOperatorPage` | Page shell: copy, FI Admin key, summary strip, filters, table + quick create, edit drawer. |
| `BookingFiltersBar` | GET form → same route; reset link. |
| `BookingOperatorTable` / `BookingOperatorRow` | Columns: when, type, status, title, linked anchors, assignee, clinic/location, actions. |
| `BookingQuickCreatePanel` | Minimum fields + **manual UUID** anchor (lead / person / patient / case); no large search/autocomplete in this stage. |
| `BookingEditDrawer` | Non-cancelled / non-completed edits via **`updateBookingAction`**; anchors read-only; cancelled rows show cancellation details only. |
| `BookingStatusBadge` / `BookingTypeBadge` | Staff-facing labels. |

Mutations reuse Stage 3A **`createBookingAction`**, **`updateBookingAction`**, **`cancelBookingAction`**, **`completeBookingAction`**. Cancelled bookings remain **immutable** for general edits (policy unchanged).

### Dashboard card

No shared FI Admin tenant “dashboard card grid” existed yet; **no** ad-hoc card was added. A compact **“Today’s bookings / next booking / overdue / link to operator page”** card can attach to a future tenant home once that pattern exists.

### Tests

`src/lib/bookings/stage3b.test.ts` — query defaults/parsing, summary math, labels, sort, cancelled filter, cap constant.

---

## Stage 3C — Calendar view (implemented)

**Purpose:** first **visual scheduling** surface for CRM-capable FI Admin users — day and week UTC grids over `fi_bookings`, with URL-driven filters, drawer details, and the same server actions as Stage 3A/3B. This is a **scheduling layer only** (no rooms, recurrence, drag-reschedule, or surgery planning).

### FI Admin route

| Path | Notes |
|------|--------|
| `/fi-admin/[tenantId]/calendar` | Gated with **`assertCrmShellPageAccess`** (same as CRM shell and bookings operator). Nav link **Calendar** appears next to **CRM** and **Bookings** when that nav is allowed. |

### Query params (URL)

| Param | Purpose |
|-------|---------|
| `view` | `day` or `week` (default **`week`** when omitted). |
| `date` | UTC anchor `YYYY-MM-DD` (defaults to **today UTC**). Week view shows the Monday–Sunday week that contains this anchor. |
| `type` | `booking_type` filter (allow-listed). |
| `status` | `booking_status` filter (allow-listed). Selecting **`cancelled`** forces **`includeCancelled`**. |
| `assignedUserId` | UUID filter on `assigned_user_id`. |
| `clinicId` | UUID filter on `clinic_id`. |
| `includeCancelled` | `1` / `true` / `yes`. |

**Note:** Grid column headers and hour rows are labelled in **UTC** so server and client agree. Quick create / edit forms continue to use **browser local** `datetime-local` fields (same as the operator page).

### Loaders & data access

| Module | Role |
|--------|------|
| `calendarQuery.ts` | Pure: parse/search params, `calendarRangeIsoForQuery`, `calendarVisibleUtcRangeMs`, `buildCalendarHref`, `mergeCalendarHrefQuery`, optional `parseCalendarRangeOverride` (tests / deep links only — **not** used to widen the server load window). |
| `calendarView.ts` | Pure: `buildCalendarDay`, `buildCalendarWeek`, `bucketBookingsIntoCalendar`, `calendarNavigationHelpers`, `utcHourSlotIsoRange`, `layoutBookingUtcDayColumn`, grid pixel constants. |
| `calendarLabels.ts` | Pure: range title copy, `bookingTypeCalendarEventClasses` (Tailwind **theme token** classes only — `primary`, `secondary`, `muted`, `accent`, `card`, `popover`, `destructive`, `border`, `ring`). |
| `calendarLoader.ts` | `loadCalendarViewData`, `loadCalendarBookings`, `loadCalendarResources` — tenant-scoped; loads **only** the visible day or week via range overlap. |
| `bookings.ts` | **`loadBookingsForCalendarOverlap`** — same overlap semantics as `loadBookingsForOperatorView`, but **`select`** on a column subset (omits created audit columns) and maps to `FiBookingRow`; default cap **`CALENDAR_VIEW_BOOKINGS_LIMIT` (800)** in `operatorBookingConstants.ts`. |

### UI components (`src/components/fi/bookings/calendar/`)

| Component | Role |
|-----------|------|
| `BookingCalendarPage` | Client shell: admin key, toolbar, optional filters, grid, quick create (with slot prefill), drawer, edit drawer. |
| `BookingCalendarToolbar` | Prev / Today / Next, Day/Week links, Filters toggle, Create booking, range title. |
| `BookingCalendarGrid` | Switches `BookingCalendarDayView` vs `BookingCalendarWeekView`. |
| `BookingCalendarWeekView` / `BookingCalendarDayView` | 24h UTC columns, hour rows (clickable empty slots → prefill quick create). |
| `BookingCalendarEventCard` | Title, type label, status badge, time range, assignee; opens drawer on click. |
| `BookingCalendarFilters` | GET form preserving `view` + `date`; same filter dimensions as operator list. |
| `BookingCalendarDrawer` | Read-oriented summary + **Edit** (opens `BookingEditDrawer`) / **Complete** / **Cancel** via Stage 3A actions. |

`BookingQuickCreatePanel` accepts optional **`slotPrefill`** `{ startIso, endIso }` for toolbar create and empty-slot clicks.

### Supported views

- **Week** (default): Monday 00:00 UTC → the following Monday (exclusive) for data loading; seven day columns.
- **Day**: single UTC midnight → next midnight.

**Month view:** intentionally **not** implemented in Stage 3C (density, overflow, and performance need a dedicated pass). Revisit in a later milestone if product priority changes.

### Tests

`src/lib/bookings/stage3c.test.ts` — calendar URL parsing, UTC week/day boundaries, navigation deltas, bucketing, slot ISO range, layout clamping, and theme-token event classes (run via `npm run test:unit`).

### Known limitations (Stage 3C)

- UTC grid vs local `datetime-local` on forms — staff should be aware when comparing grid placement to typed local times.
- No overlap-aware horizontal stacking for simultaneous bookings in one column (events may visually overlap; acceptable for first release).
- Row cap: if more than **800** bookings overlap the visible range with current filters, the UI warns to narrow filters or use the operator list.

### Dashboard integration

**Not required** for Stage 3C. A future tenant home/dashboard card can deep-link to `/calendar` with `view`, `date`, and filter query params.

### Deferred to Stage 3D (and beyond)

- Drag/drop rescheduling and resize handles on events.
- Recurring bookings.
- Room / multi-resource scheduling columns.
- Calendar subscriptions (webcal) and **external calendar sync** (Google/Microsoft).
- Automated reminders.

Cross-cutting follow-ups (unchanged direction): ICS export, patient portal read-only view, and dual-write to clinical `fi_timeline_events` when `case_id` is set and the case timeline policy allows it.

---

## Related docs

- CRM checklist: [18-crm-foundation-implementation-checklist.md](./18-crm-foundation-implementation-checklist.md) (Stage 2L conversion unlocks bookings).
- CRM architecture: [17-crm-foundation-architecture.md](./17-crm-foundation-architecture.md).
