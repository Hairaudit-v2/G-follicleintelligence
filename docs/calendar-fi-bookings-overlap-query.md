# FI calendar — `fi_bookings` overlap query path

Operational calendar reads use `loadBookingsForCalendarOverlap` in `src/lib/bookings/bookings.ts`, which builds a Supabase/PostgREST query against `public.fi_bookings`.

## Logical SQL shape

```sql
SELECT <FI_BOOKINGS_CALENDAR_OVERLAP_SELECT column list>
FROM public.fi_bookings
WHERE tenant_id = :tenant_id
  AND start_at < :range_end_iso
  AND end_at > :range_start_iso
  -- optional filters when URL params are set:
  AND booking_status = :status            -- if ?status=
  AND booking_type = :type                -- if ?type=
  AND assigned_user_id = :user            -- if ?assignedUserId=
  AND (assigned_staff_id = :sid OR (...)) -- if ?staffId= (legacy user link OR)
  AND clinic_id = :clinic_id              -- if ?clinicId=
  AND room_id = :room_id                  -- if ?roomId=
  AND booking_status <> 'cancelled'       -- unless includeCancelled / status=cancelled
ORDER BY start_at ASC
LIMIT :limit;                             -- default CALENDAR_VIEW_BOOKINGS_LIMIT (800)
```

Overlap semantics: any row where the booking interval intersects `[range_start_iso, range_end_iso)` in UTC ISO strings.

## `EXPLAIN (ANALYZE, BUFFERS)` (run in Supabase SQL editor)

Replace UUIDs and timestamps with a real tenant and a visible-range window:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, lead_id, person_id, patient_id, case_id, clinic_id, room_id, room_required,
       assigned_staff_id, assigned_user_id, booking_type, booking_status, title, description,
       start_at, end_at, timezone, location, metadata, cancelled_at, cancelled_by_user_id, cancellation_reason
FROM public.fi_bookings
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND start_at < '2026-07-01T00:00:00.000Z'
  AND end_at > '2026-06-01T00:00:00.000Z'
  AND booking_status <> 'cancelled'
ORDER BY start_at ASC
LIMIT 800;
```

Existing indexes that typically participate: `idx_fi_bookings_tenant_start (tenant_id, start_at)`, plus filters on `clinic_id`, `room_id`, `assigned_staff_id` when present.

Optional: if `EXPLAIN` still shows large sequential scans on `end_at > :range_start`, consider `create index if not exists idx_fi_bookings_tenant_end on public.fi_bookings (tenant_id, end_at);` and re-check plans on production-like volume.

## Client navigation

Each calendar URL change (Month / Week / Day, date, filters) triggers a **new** RSC request. FI OS (`/fi-admin/.../calendar`) streams **`loadOperationalCalendarShellData`** first (toolbar, filters, empty grid shell), then **`loadOperationalCalendarGridData`** inside `Suspense` (overlap query + enrichment). Shared directory/services queries dedupe in-flight via React `cache()`. The dashboard calendar still uses **`loadOperationalCalendarPageData`** (shell + grid merged in one await). The client store avoids **duplicate Zustand hydrations** when the server payload fingerprint is unchanged (same logical bookings/display).

## Month summary vs drawer

Month view skips server-side clinical scales and multi-resource assignment **lines** in `bookingDisplay` to save latency. `BookingCalendarDrawer` does not render `scalesSummary` or resource summary lines — it uses the `FiBookingRow`, clinic/staff props, and `patientSummary` / procedure labels from the page. Opening **Edit** uses `BookingEditDrawer`; reminder jobs load **on demand** via `loadBookingReminderJobsAction` (calendar navigation no longer bulk-fetches reminder rows). Side panels that show scales should be used in week/day, or after navigation triggers a full-enrichment load.

## Truncation banner

`listTruncated` is set only when the overlap query returns a **full cap page** (`rawBookings.length >= CALENDAR_VIEW_BOOKINGS_LIMIT`), meaning additional rows may exist in the visible window.
