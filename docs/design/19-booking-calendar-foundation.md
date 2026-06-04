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
| `bookings.ts` | Supabase mutations + loaders + tenant FK checks + CRM activity when `lead_id` is set. |
| `server.ts` | `server-only` re-exports for routes/actions. |

**CRM activity kinds** (only when `lead_id` present): `booking.created`, `booking.updated` (with `changed_keys`), `booking.cancelled`, `booking.completed`. Detail payload is IDs (+ `changed_keys` on update) only — no free-text PII.

### UI (Stage 3A)

Lead detail (`fi-admin/[tenantId]/crm/leads/[leadId]`):

- `LeadBookingPanel` — lists upcoming vs past/cancelled, optional FI Admin key, create/edit/cancel/complete.
- `BookingCreatePanel` / `BookingSummaryCard` — building blocks under `src/components/fi/bookings/`.

Loader: `loadCrmShellLeadBundle` now includes **`leadBookings`** via `loadBookingsForLead`.

### Tests

`src/lib/bookings/stage3a.test.ts` — pure policy / changed-field / sort coverage (run via `npm run test:unit`).

---

## Stage 3B / 3C — Calendar (planned, not implemented)

| Stage | Goal |
|-------|------|
| **3B** | Read-only **calendar grid** for a clinic or tenant: month/week views, conflict hints, drag-free navigation; reuse `loadBookingsForTenantRange`. |
| **3C** | **Interactive scheduling** — drag/drop reschedule, resource columns (rooms/chairs), recurrence rules, external calendar sync hooks; extend `metadata` conventions and possibly add `fi_booking_resources`. |

Cross-cutting follow-ups: ICS export, patient portal read-only view, and dual-write to clinical `fi_timeline_events` when `case_id` is set and the case timeline policy allows it.

---

## Related docs

- CRM checklist: [18-crm-foundation-implementation-checklist.md](./18-crm-foundation-implementation-checklist.md) (Stage 2L conversion unlocks bookings).
- CRM architecture: [17-crm-foundation-architecture.md](./17-crm-foundation-architecture.md).
