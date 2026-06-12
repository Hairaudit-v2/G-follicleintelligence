# FI OS — production readiness runbook

**Audit date:** 2026-06-10  
**Scope:** Follicle Intelligence OS operational surfaces (ClinicOS, SurgeryOS, reception, staff PIN, **manual** payment records, tenant-local calendars). This is a **deployment and access** checklist — not a penetration test or full data-governance review.

**See also (2026-06-12 hardening audits):** [Master checklist](fi-os-production-hardening-master-checklist.md) · [Env vars](fi-os-env-vars-production-audit.md) · [Auth](fi-os-auth-production-audit.md) · [Backup & recovery](fi-os-backup-recovery-production.md) · [Cron](fi-os-cron-production-audit.md) · [Webhooks](fi-os-webhook-production-audit.md)

## Commercial integrations — explicit non-scope

The following are **not live** in this product as integrated, automated financial systems:

- **Stripe** (or other card processors) for FI OS payment capture  
- **Invoicing** or **POS**  
- **Accounting** exports or GL sync  

**`fi_payment_records`** is **manual / internal tracking only**: staff-entered expectations and status for deposits and related surgery commercial steps. It is **not** a bank ledger, tax invoice system, or reconciliation engine. Treat all payment UX as **operational visibility**, not billing automation.

---

## 1. Deployment blockers

| # | Blocker | Detail |
|---|---------|--------|
| 1 | **Pending database migrations** | Production (and any preview DB used for FI OS) must apply **all** migrations the release branch expects, through at least **`20260718120002_fi_case_procedures_v11_team_milestones.sql`**. Missing columns on `fi_case_procedures` breaks procedure day V1.1 (team + milestones). |
| 2 | **Supabase server configuration** | **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**, and **`SUPABASE_SERVICE_ROLE_KEY`** must be set on the deployment; many loaders short-circuit when service role or URL is absent. |
| 3 | **`NODE_ENV` on public hosts** | Production **HTML** route guards and **`/api/tenants`** staff checks key off **`process.env.NODE_ENV === 'production'`** only (not `VERCEL_ENV`). See [`docs/fi-os-access-production.md`](../fi-os-access-production.md). |

**Verify after deploy:** tenant **`default_timezone`** / operational calendar settings (e.g. **Australia/Perth** for Evolved) for “today” windows, agenda buckets, and deposit due-date copy.

---

## 2. Migrations to apply

Apply every file under **`supabase/migrations/`** in **lexicographic (timestamp) order** on the target Supabase project. Use `supabase migration list`, the Supabase dashboard, or your CI pipeline — **do not skip or duplicate** versions.

For **incremental** releases that already have the June 2026 FI foundation, the **ordered July 2026 chain** below is the minimum **new** prefix that backs current FI OS operational work (rooms on bookings, staff PIN audit, external mappings, **manual payment records**, procedure day V1.1). **Only apply migrations your database has not yet recorded.**

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
| 20 | **`20260718120002_fi_case_procedures_v11_team_milestones.sql`** — procedure day V1.1 (`nurse_user_id`, `technician_user_ids`, `procedure_milestones`) |

**Latest migration in repo at audit:** `20260718120002_fi_case_procedures_v11_team_milestones.sql`.

---

## 3. Environment variables (required and common)

**Never** expose `SUPABASE_SERVICE_ROLE_KEY`, `FI_ADMIN_API_KEY`, cron secrets, or integration secrets as `NEXT_PUBLIC_*`.

### Required for core FI Admin / Auth

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL (browser + server). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Anon key for Auth / session resolution (`resolveAuthUserId`, client). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Server only.** `supabaseAdmin()` loaders, mutations, RLS bypass where coded. |
| `NODE_ENV` | **Yes** (runtime) | Must be **`production`** on public hosts for portal gates documented in [`docs/fi-os-access-production.md`](../fi-os-access-production.md). |

### Optional but commonly set in production

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Password reset / invite fallback when `Host` / `X-Forwarded-*` are missing in server actions. |
| `FI_ADMIN_API_KEY` | Operator-key path for selected admin mutations (including some **payment record** writes when keyed — see `assertPaymentRecordWriteAllowed` / CRM gates). |
| `FI_TIMELY_WEBHOOK_SECRET` | **Required in production** for Timely Zapier webhooks to `POST /api/tenants/[tenantId]/integrations/timely/patient|appointment|discovery` when those routes are used. |
| `FI_REMINDER_CRON_SECRET` | Cron: `POST/GET /api/cron/fi-reminder-jobs` (min 16 chars when enabled). |
| `RESEND_*` / `TWILIO_*` | Reminder and related email/SMS delivery (see `.env.example`). |
| `OPENAI_API_KEY` | DoctorOS voice notes / pathology AI where enabled. |
| `CRON_SECRET`, `EVOLVED_PERTH_TENANT_ID`, `FI_BASE_URL`, `IIOHR_HR_SYNC_SECRET`, `IIOHR_HR_PERTH_STAFF_FEED_URL`, `IIOHR_HR_PERTH_STAFF_FEED_KEY` | IIOHR / Evolved Perth HR sync cron and staff feed (see [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md)). |

**Local development only:** `FI_ENABLE_DEV_ADMIN_ACCESS` — **ignored when `NODE_ENV=production`**.

Full inventory: [`.env.example`](../../.env.example) and [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md).

---

## 4. Staff PIN route rules

PIN sessions are **clinic-floor** sessions: limited **HTTP navigation** under `/fi-admin/[tenantId]/…` plus **server-side mutation policy** for dangerous writes.

### 4.1 Path restriction (layout redirect)

- **Implementation:** `PIN_RESTRICTED_ROUTE_PREFIXES` and `isStaffPinRestrictedRoute` in `src/lib/staffPin/staffPinPermissions.ts`.
- **Tenant layout:** `app/(fi-admin)/fi-admin/[tenantId]/layout.tsx` — valid PIN session + restricted path → **`redirect(`${base}/calendar`)`**.
- **Pathname header:** `middleware.ts` sets **`x-pathname`** so the layout can evaluate the true path (required for correct PIN routing).

**Restricted path suffixes** (after `/fi-admin/[tenantId]`) — any exact match or subpath is blocked for PIN and redirected to **`/calendar`**:

| Prefixes (from code) |
|----------------------|
| `/settings`, `/configuration`, `/system-status`, `/audit`, `/prescriptions`, `/medication-reorders`, `/services`, `/staff`, `/analytics`, `/doctor`, `/cases`, `/surgery-readiness`, `/procedure-day`, `/operations`, `/tomorrow`, `/consultation-conversion`, `/crm`, `/hr/` |

**Not in that list** (examples — PIN navigation is **not** redirected by this layout check): tenant home **`/`**, **`/calendar`**, **`/reception`**, **`/bookings`**, **`/patients`**, **`/consultations`**, and other suffixes not matching the prefixes above. **Server actions and API routes** may still reject PIN for sensitive domains (e.g. payment writes) — see §4.3.

**Special case:** `/fi-admin/[tenantId]/staff-pin-login` — layout skips PIN restriction logic for the login page itself (`isStaffPinLogin`).

### 4.2 Allowed PIN “floor” actions (mutation policy)

`canUseStaffPinClinicSession` allows only:

`calendar.view`, `calendar.quick_book`, `patient.check_in`, `reception.board_flow`, `appointment.notes`, `tasks.view_assigned`, `patient.appointment_context`.

Evaluator: `src/lib/staffPin/staffPinMutationGuard.ts` (pure); server enforcement uses `rejectStaffPinSessionForRestrictedMutation` / `assertStaffPinMutationDecision` patterns in `src/lib/staffPin/staffPinMutationGuard.server.ts` and CRM gates (e.g. staff management, pricing).

### 4.3 Quick reference — operational boards vs PIN

| Surface | Typical path | PIN layout navigation |
|---------|--------------|------------------------|
| Reception board | `/reception` | **Allowed** (not restricted). |
| Calendar | `/calendar` | **Allowed**. |
| Operations centre | `/operations` | **Redirect to calendar**. |
| Tomorrow board | `/tomorrow` | **Redirect to calendar**. |
| Consultation conversion | `/consultation-conversion` | **Redirect to calendar**. |
| Surgery readiness | `/surgery-readiness` | **Redirect to calendar**. |
| Procedure day | `/procedure-day` | **Redirect to calendar**. |
| Cases / CRM / settings / staff / services / prescriptions | `/cases`, `/crm`, `/settings`, … | **Redirect to calendar** when prefix matches §4.1. |

---

## 5. Payment behaviour (**manual / internal only**)

**There is no live Stripe, invoicing, POS, or accounting integration in FI OS for these records.**

| Topic | Behaviour |
|-------|-----------|
| **Storage** | `fi_payment_records` — tenant-scoped rows for surgery-related **manual** tracking (amounts/status as implemented in loaders and RLS — see migration `20260717120001_fi_payment_records.sql`). |
| **Mutations** | Gated server-side (e.g. `src/lib/payments/paymentRecordAccess.server.ts`, `PAYMENT_MUTATION_ROLES_LOWER` in `src/lib/payments/paymentRecordModel.ts`). **`crm_operator`** and other non-finance roles get **403** unless platform-admin bypass or **`FI_ADMIN_API_KEY`** path where implemented. |
| **Staff PIN** | **Blocked** for restricted payment mutations (`rejectStaffPinSessionForRestrictedMutation` / related guards). |
| **Boards / readiness** | Missing row → informational `no_payment_tracking`; pending/overdue → **`surgery_deposit_pending`** style signals (**warning** / escalation by proximity to surgery — see model loaders). |

---

## 6. Operational route access matrix (production)

**Baseline (full Supabase session):** `assertFiTenantPortalAccess` in `src/lib/fiOs/fiOsPortalGate.server.ts` when `NODE_ENV === 'production'`: session required; tenant row must exist; user must be cross-tenant OS directory role (`fi_platform_admin`, `fi_admin`, `fi_auditor`) **or** have **`fi_users`** membership for that `tenant_id`. Detail and API behaviour: [`docs/fi-os-access-production.md`](../fi-os-access-production.md).

| Route (under `/fi-admin/[tenantId]/`) | Full session (typical gate) | Staff PIN session (layout + §4) |
|---------------------------------------|----------------------------|-----------------------------------|
| *(tenant index)* `/` | `assertFiTenantPortalAccess` | Allowed if not under §4.1 restricted prefix |
| `/calendar` | `assertFiTenantPortalAccess` | **Allowed** |
| `/reception` | `assertFiTenantPortalAccessUnlessStaffPinSession` (page) / portal for full session | **Allowed** |
| `/bookings`, `/patients`, `/consultations` | Portal access | **Allowed** at layout level; APIs still enforce role/PIN |
| `/operations` | Portal access | **Redirect to `/calendar`** |
| `/tomorrow` | Portal access | **Redirect to `/calendar`** |
| `/consultation-conversion` | Portal access | **Redirect to `/calendar`** |
| `/surgery-readiness` | Portal access | **Redirect to `/calendar`** |
| `/procedure-day` | Portal access | **Redirect to `/calendar`** |
| `/cases`, `/crm`, `/settings`, `/staff`, `/services`, … | Portal / CRM gates | **Redirect to `/calendar`** when path matches §4.1 |

**Platform:** `/fi-admin/system/…` — `fi_platform_admin` only (all environments). **`/hair-audit/admin`** — OS auditor/admin roles per `fi-os-access-production.md`.

---

## 7. Test status (verified on audit date)

Commands from repository root:

```bash
npm run lint
npm run test:unit
npx tsc --noEmit
```

| Command | Status |
|---------|--------|
| `npm run lint` | **Pass** — no ESLint warnings or errors. |
| `npm run test:unit` | **Pass** — **740** tests, **0** failures (121 suites). |
| `npx tsc --noEmit` | **Pass** — full project typecheck. |

---

## 8. Evolved Perth go-live workflow (reference)

End-to-end **operational** path for a hair-restoration tenant (e.g. Evolved). **Deposit step** means a **manual** `fi_payment_records` update by authorised staff — **not** card capture.

1. **Provision tenant and defaults**  
   - Script: `npm run dev:provision:evolved` — see [`docs/dev-provision-evolved-tenant.md`](../dev-provision-evolved-tenant.md).  
   - Or SQL: `docs/sql/provision-evolved-hair-clinics-tenant.sql`.  
   - Optional env: `FI_EVOLVED_TENANT_SLUG`, `FI_EVOLVED_TENANT_NAME`, `FI_EVOLVED_DEFAULT_TIMEZONE` (default **Australia/Perth**).

2. **Apply migrations** through §2 (including **`20260712120005_seed_perth_clinic_rooms.sql`** when using Perth room seed).

3. **Link Auth users** — `update fi_users set auth_user_id = …` for operators.

4. **Operational journey (conceptual)**  

   ```text
   Lead / CRM
     → Consultation (consultations + calendar)
     → Manual deposit tracking (fi_payment_records — internal only; not Stripe)
     → Surgery booking (calendar / bookings; room requirements per tenant config)
     → Tomorrow Board (/tomorrow) — operator session
     → Reception Board (/reception) — clinic floor; PIN allowed here
     → Procedure Day Board (/procedure-day) — operator session (PIN redirected at layout)
     → Case detail / procedure day section — milestones, team fields (V1.1 migration)
   ```

5. **Perth-specific checks**

   - [ ] Tenant / clinic operational timezone **Australia/Perth** (or intended IANA zone) in tenant settings.  
   - [ ] Room + service eligibility data present if using Evolved Perth physical room layout from migrations.

---

## 9. Known limitations

| Topic | Limitation |
|-------|------------|
| **Payments** | **Manual internal tracking only** — no processor, **no** automated invoicing, **no** POS, **no** accounting system of record. |
| **`fi_case_procedures` / `fi_cases`** | RLS posture is **not** “hardened for arbitrary authenticated clients” everywhere; many paths use **`supabaseAdmin()`** and app-layer checks. |
| **PIN + deep links** | PIN sessions hitting **`/cases/...`** (restricted) are **redirected to calendar** by design; “copy case link” flows may be **operator-only**. |
| **Sidebar vs redirect** | Some nav items may still **render** under PIN; **enforcement is redirect + server mutation gates**, not only hiding links. |
| **Routes not in §4.1 list** | PIN can open e.g. **`/bookings`** / **`/patients`** at the layout level; rely on **per-route and per-mutation** checks for sensitive reads/writes. |
| **Tenant timezone** | Operational “today” and payment due copy depend on tenant calendar settings — confirm per environment. |

---

## 10. Post-deploy verification checklist

- [ ] **Migrations** — production DB at or past **`20260718120002_fi_case_procedures_v11_team_milestones.sql`**.  
- [ ] **Procedure day links** — case links use procedure-day anchor where implemented (`caseProcedureDayDetailHref` in `src/lib/cases/caseDetailNavConstants.ts`; loaders e.g. `surgeryReadinessBoardLoader.server.ts`).  
- [ ] **Staff PIN** — restricted routes redirect to **`/calendar`**; reception usable on floor.  
- [ ] **Env** — Supabase trio set; optional keys per integrations in use.  
- [ ] **Lint / unit / tsc** — re-run §7 before each production promote.

---

## Related documents

| Document | Use |
|----------|-----|
| [`docs/fi-os-access-production.md`](../fi-os-access-production.md) | Production gates, roles, `/api/tenants`, password reset. |
| [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md) | Full env inventory. |
| [`docs/dev-provision-evolved-tenant.md`](../dev-provision-evolved-tenant.md) | Evolved tenant provisioning. |
| [`docs/design/fi-payment-records-access.md`](../design/fi-payment-records-access.md) | Payment record access design notes. |
