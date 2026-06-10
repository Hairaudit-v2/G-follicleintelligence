# FI OS operational production readiness

This runbook captures the **FI OS operational production readiness audit** (SurgeryOS boards, ClinicOS surfaces, staff PIN, **manual** payment records, tenant-local dates). It is **not** a security penetration test and **not** a full data-governance review.

**Out of scope (not live in this product surface):** Stripe, invoicing, POS, integrated accounting, or automated billing. **Payment records** are **manual / internal tracking** only (`fi_payment_records` — staff-recorded status, not a ledger).

---

## 1. Deployment blockers

| # | Blocker | Detail |
|---|---------|--------|
| 1 | **Pending database migrations** | Production (and any preview DB used for FI OS) must apply **all** migrations the release branch expects, through at least **`20260718120002_fi_case_procedures_v11_team_milestones.sql`**. Missing columns on `fi_case_procedures` will break procedure day V1.1 reads/writes. |
| 2 | **TypeScript project check** | **`npx tsc --noEmit` currently fails** (fixtures in several `*.test.ts` files, e.g. `FiBookingRow` stubs missing `room_id` / `room_required`, and other test-only typing drift). **If CI or `next build` enforces full-project typecheck**, this **must be fixed** or tests excluded from the typecheck graph before merge/deploy. |
| 3 | **Supabase server configuration** | **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** must be set on the deployment; operational pages short-circuit with “Server misconfigured” when they are absent. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** is required for **Auth** / session resolution used by portal gates. |

Non-blockers but verify: tenant **`calendarTimezone`** (e.g. **Australia/Perth** for Evolved) is set correctly for operational “today” windows and deposit due-date semantics.

---

## 2. Required migrations (apply in order)

Apply migrations **in filename (timestamp) order** on the target Supabase project. Use `supabase migration list` / the Supabase dashboard to confirm nothing is skipped or duplicated.

The following **July 2026** migrations are the ordered chain that backs recent FI OS operational work (rooms, bookings, staff PIN audit, external mappings, **manual payment records**, **procedure day V1.1**). **Your production may already have an earlier prefix applied** — only apply **pending** files.

| Order | Migration file |
|------:|----------------|
| 1 | `20260701120001_fi_medication_reorder_portal.sql` |
| 2 | `20260702120001_fi_platform_admin.sql` |
| 3 | `20260703120001_fi_staff_sync_runs.sql` |
| 4 | `20260704120001_fi_tenant_admin_users.sql` |
| 5 | `20260705120001_fi_tax_localisation_settings.sql` |
| 6 | `20260708120001_fi_tenant_admin_audit_admin_user_removed.sql` |
| 7 | `20260709120001_fi_staff_pins.sql` |
| 8 | `20260710120001_fi_consultations_booking_id.sql` |
| 9 | `20260711120001_fi_consultations_consultant_staff_id.sql` |
| 10 | `20260712120001_fi_clinic_rooms.sql` |
| 11 | `20260712120002_fi_service_room_eligibility.sql` |
| 12 | `20260712120003_fi_service_staff_eligibility.sql` |
| 13 | `20260712120004_fi_bookings_room_columns.sql` |
| 14 | `20260712120005_seed_perth_clinic_rooms.sql` |
| 15 | `20260713120001_fi_booking_resource_requirements.sql` |
| 16 | `20260714120001_fi_clinic_rooms_physical_key_non_unique.sql` |
| 17 | `20260715120001_fi_staff_pin_audit_reception_board.sql` |
| 18 | `20260716120001_fi_external_entity_mappings.sql` |
| 19 | `20260717120001_fi_payment_records.sql` |
| 20 | **`20260718120002_fi_case_procedures_v11_team_milestones.sql`** — **required** for procedure day V1.1 (`nurse_user_id`, `technician_user_ids`, `procedure_milestones`) |

---

## 3. Required Vercel / Supabase environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL (browser + server). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase **anon** key for Auth / session; used by portal and CRM gates. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Server only.** All `supabaseAdmin()` loaders, mutations, and bypass of table RLS where applicable. |
| `FI_ADMIN_API_KEY` | Optional | Operator-key path for selected admin actions and **payment record** mutations when keyed (see `assertPaymentRecordWriteAllowed`). |

Further detail: [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md).

**Never** expose `SUPABASE_SERVICE_ROLE_KEY` or `FI_ADMIN_API_KEY` as `NEXT_PUBLIC_*`.

---

## 4. Staff PIN route rules

Implementation references:

- Restricted path suffixes: `src/lib/staffPin/staffPinPermissions.ts` (`PIN_RESTRICTED_ROUTE_PREFIXES`).
- Tenant layout gate: `app/(fi-admin)/fi-admin/[tenantId]/layout.tsx` (valid PIN session → `assertFiTenantExists` + redirect if restricted; else `assertFiTenantPortalAccess`).
- Path for restriction checks: `middleware.ts` sets the **`x-pathname`** header (required for correct PIN routing).

| Surface | Under `/fi-admin/[tenantId]/…` | PIN session (clinic floor) |
|---------|----------------------------------|----------------------------|
| **Reception board** | `/reception` | **Allowed** — not in restricted prefix list; page uses `assertFiTenantPortalAccessUnlessStaffPinSession`. |
| **Operations centre** | `/operations` | **Blocked** — restricted; layout redirects to `/calendar`. |
| **Tomorrow board** | `/tomorrow` | **Blocked** — restricted. |
| **Consultation conversion** | `/consultation-conversion` | **Blocked** — restricted. |
| **Surgery readiness** | `/surgery-readiness` | **Blocked** — restricted. |
| **Procedure day** | `/procedure-day` | **Blocked** — restricted. |
| **Cases / CRM / settings / staff / prescriptions / …** | e.g. `/cases`, `/crm`, `/settings` | **Blocked** — restricted prefixes match. |

Allowed PIN actions (floor): `canUseStaffPinClinicSession` in the same module (e.g. calendar, reception board flow, check-in). **Payment and other restricted mutations** are blocked under PIN via `rejectStaffPinSessionForRestrictedMutation` (`src/lib/staffPin/staffPinMutationGuard.server.ts`).

---

## 5. Payment records behaviour (manual / internal)

**Manual / internal tracking only** — not Stripe, not invoicing, not POS, not accounting export.

| Scenario | Readiness / boards | Mutations (server) |
|----------|--------------------|--------------------|
| **No `fi_payment_records` row** for surgery context | `no_payment_tracking` issue at **info** severity — **neutral** (informational). | N/A |
| **Pending / overdue / partially paid** (needs collection) | **`surgery_deposit_pending`** at **warning** (can escalate by days-to-surgery). | Requires finance-capable role or `FI_ADMIN_API_KEY`; **staff PIN blocked**. |
| **`crm_operator` (and other non-finance roles)** | May see neutral/actionable **copy** in UI depending on surface. | **`assertPaymentRecordWriteAllowed`** → **403** unless platform-admin bypass or admin key. |
| **Finance / manager / admin / owner / `fi_admin`** | Same as above for UX. | **Allowed** subject to server check; **RLS** on `fi_payment_records` allows **INSERT/UPDATE** only for aligned `fi_users.role` values (see migration `20260717120001_fi_payment_records.sql`). |

Server gate: `src/lib/payments/paymentRecordAccess.server.ts`.  
Role set: `PAYMENT_MUTATION_ROLES_LOWER` in `src/lib/payments/paymentRecordModel.ts`.

---

## 6. Operational route access matrix

| Route | Page gate (typical) | Staff PIN (layout) |
|-------|---------------------|---------------------|
| `/fi-admin/[tenantId]/operations` | `assertFiTenantPortalAccess` | Redirect to calendar |
| `/fi-admin/[tenantId]/reception` | `assertFiTenantPortalAccessUnlessStaffPinSession` | **Allowed** if not restricted |
| `/fi-admin/[tenantId]/tomorrow` | `assertFiTenantPortalAccess` | Redirect to calendar |
| `/fi-admin/[tenantId]/consultation-conversion` | `assertFiTenantPortalAccess` | Redirect to calendar |
| `/fi-admin/[tenantId]/surgery-readiness` | `assertFiTenantPortalAccess` | Redirect to calendar |
| `/fi-admin/[tenantId]/procedure-day` | `assertFiTenantPortalAccess` | Redirect to calendar |

Production portal membership: `assertFiTenantPortalAccess` in `src/lib/fiOs/fiOsPortalGate.server.ts` (`NODE_ENV === 'production'`).

---

## 7. Cross-link verification checklist

Use after each deploy or when changing loaders/nav.

- [ ] **Procedure day board** — Case links resolve to case detail **including procedure-day anchor** (`#case-procedure-day`) where implemented (`caseProcedureDayDetailHref` in `src/lib/cases/caseDetailNavConstants.ts`).
- [ ] **Surgery readiness board** — Linked case URLs use the same **procedure-day deep link** when `caseId` is present (loader: `src/lib/surgery/surgeryReadinessBoardLoader.server.ts`).
- [ ] **Tomorrow / operations / conversion** — Nav entries point at `/fi-admin/[tenantId]/…` paths that exist and match `fiOsShellPrimaryNav` / ClinicOS config.
- [ ] **Case detail** — “Procedure day board” and “Surgery readiness” back-links from `CaseDetailPageView` hit live routes.
- [ ] **Staff PIN** — From a PIN session, opening a **case deep link** hits **`/cases`** (restricted) → expect **redirect to calendar** (by design); do not treat as a broken link for kiosk flows.

---

## 8. Test commands and current status

Commands (from repository root):

```bash
npm run lint
npm run test:unit
npx tsc --noEmit
```

| Command | Status (last audit) |
|---------|---------------------|
| `npm run lint` | **Passes** — no ESLint warnings or errors. |
| `npm run test:unit` | **Passes** — **740** tests, **0** failures. |
| `npx tsc --noEmit` | **Fails** — must be remediated **before** merge/deploy **if** your pipeline enforces full-project typecheck (see §1). |

---

## 9. Known limitations

| Topic | Limitation |
|-------|------------|
| **`fi_case_procedures`** | Migrations in-repo **do not enable RLS** on this table. Access is **application + service role** (`supabaseAdmin()`), consistent with the broader pattern that **`fi_cases`** is not RLS-hardened for arbitrary authenticated clients. |
| **Payment records** | **Manual** staff tracking only; no payment processor, no automated reconciliation. |
| **PIN + case URLs** | Kiosk PIN sessions **cannot** browse `/cases/...`; shared “copy case link” flows may be **operator-only**. |
| **Tenant timezone** | Operational “today” and due dates depend on **tenant operational calendar** settings; default seeds/docs often use **Australia/Perth** for Evolved — still verify per-tenant DB values. |
| **Primary nav under PIN** | Some sidebar items may still appear; **restricted routes redirect** rather than always hiding the link. |

---

## 10. Go-live workflow — Evolved Perth (reference)

End-to-end **operational** path (CRM + bookings + SurgeryOS). **Manual deposit** means **`fi_payment_records`** entry — not card capture.

```text
Lead
  → Consultation (ConsultationOS / consultations)
  → Manual deposit (record expectation / status in fi_payment_records — internal only)
  → Surgery booking (calendar / bookings; room requirements per tenant)
  → Tomorrow Board (/tomorrow) — next-day operational snapshot
  → Reception Board (/reception) — clinic floor; staff PIN allowed here
  → Procedure Day Board (/procedure-day) — today’s surgery lane; operator session required (not PIN kiosk)
  → Case completion (case detail → Procedure day section → status / milestones / summary; post-op is Stage 5D)
```

**Perth-specific checks**

- [ ] Tenant / clinic timezone **Australia/Perth** (or intended IANA zone) on operational calendar settings.
- [ ] Room and service eligibility seeds applied where using Evolved Perth room layout (`20260712120005_seed_perth_clinic_rooms.sql` and related booking/room migrations).

---

## Follow-up blockers (engineering backlog)

1. **Fix `tsc --noEmit`** for CI if typecheck is enforced project-wide.  
2. **Confirm Supabase migration history** on production matches §2 through **`20260718120002_…`**.  
3. **Optional UX**: hide or disable sidebar entries for PIN sessions when the route is restricted (today: redirect-only).

---

## Files changed (this documentation change)

| File | Action |
|------|--------|
| `docs/runbooks/fi-os-production-readiness.md` | **Added** (this runbook) |

No application code was modified as part of adding this document.
