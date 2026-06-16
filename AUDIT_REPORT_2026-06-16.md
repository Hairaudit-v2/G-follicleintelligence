# Follicle Intelligence — Full Codebase & Data Audit
**Date:** 2026-06-16  
**Scope:** Security · Code Quality · Data Integrity · Performance  
**Files audited:** 2,248 source files · 114 DB migrations · 4,690 CRM records

---

## 🔴 CRITICAL — Act Today

### [CRIT-1] Live production secrets in `.env.local`
The `.env.local` file contains real, active credentials:

| Secret | Risk |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Full RLS-bypassing DB admin access (expires 2087) |
| `OPENAI_API_KEY` | `sk-proj-...` live key — billing + data exposure |
| `RESEND_API_KEY` | Transactional email — phishing risk from your domain |
| `SUPABASE_DB_PASSWORD` | Direct Postgres password (`Bucadog12##`) |
| `FI_ADMIN_API_KEY` (2 conflicting values) | Admin API auth |
| `FI_REMINDER_CRON_SECRET` (2 conflicting values) | Cron auth |

**Action:** Rotate all of the above immediately. Verify the file was never committed: `git log --all -- .env.local`. If it was, use BFG Repo Cleaner to purge history.

### [CRIT-2] ~168 CSV phone numbers corrupted by Excel scientific notation
`6.14E10` (106 records) and `6.15E10` (49 records) appear in the HubSpot export — Excel mangled Australian mobile numbers into scientific notation, collapsing unrelated people onto the same "phone number". Any deduplication logic operating on raw phone strings will merge these leads incorrectly.

### [CRIT-3] `fi_cases` cascade delete silently wipes entire clinical audit trail
A single `DELETE FROM fi_cases WHERE id = $1` destroys: intakes, uploads, signals, model runs, scorecards, reports, audits, and timeline events — with no soft-delete, no recycle bin, and no warning. This cascade chain is dangerous in production.

---

## 🟠 HIGH

### Security

**[SEC-H1] No auth enforcement in middleware** — `middleware.ts` only sets headers; it does not validate sessions or redirect unauthenticated requests on `/fi-admin/*`. Every admin route is solely protected by individual route-level checks, with no safety net.

**[SEC-H2] No CSP or security headers** — `next.config.mjs` sets no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` on any route.

**[SEC-H3] `Access-Control-Allow-Origin: *` on all image paths** — Includes patient clinical images (scalp maps, pathology results) served through `/_next/image`. Patient images should not be embeddable cross-origin.

**[SEC-H4] `FI_ENABLE_DEV_ADMIN_ACCESS=true` in `.env.local`** — If this file is ever used in a non-Vercel environment without `NODE_ENV=production`, unauthenticated requests to `GET /api/tenants` return the full tenant list.

**[SEC-H5] `auditor@hairaudit.com` hardcoded as `fi_platform_admin`** in production migrations `20260614120001` and `20260702120001`. If this account is compromised, a platform admin role is granted to the attacker. No `WHERE NOT EXISTS` guard limits this to the original environment.

### Code Quality

**[CODE-H1] `blood_extract` and `image_extract` pipeline stages are stubs writing empty data to DB**
- `lib/fi/stages/blood_extract.ts:50` — returns `{ name: "placeholder", value: null }` for every blood upload. Comment: `// TODO: run actual PDF/CSV extraction`
- `lib/fi/stages/image_extract.ts:51` — returns `signals: {}` for every image. Comment: `// TODO: run actual image analysis`

Patients are being assessed on empty signal data. Gate these with a feature flag or throw a `NotImplementedError` so callers know the result is unavailable.

### Data Integrity

**[DATA-H1] `Patient` TypeScript type is invalid** — `src/types/fi.ts` defines `Patient.full_name: string` and `Patient.email: string` but `fi_patients` has neither column (PII lives in `fi_intakes` by design). Code consuming these fields is accessing non-existent columns.

**[DATA-H2] `fi_crm_leads.primary_owner_user_id` — no FK constraint, no index** — Orphaned owner UUIDs can accumulate silently; the CRM shell page does a sequential scan on every tenant view.

**[DATA-H3] `Non-Surgical` CSV column silently dropped on import** — `stg_hubspot_contacts_imports` has no corresponding column. If `Non-Surgical` signals a treatment track, downstream lead routing will be uninformed.

**[DATA-H4] 52 CSV records have email address pasted into First Name field** — Will create `fi_persons` with garbage display names and break any name-based CRM logic.

**[DATA-H5] 11 CSV leads have no email AND no phone** — Permanently unreachable; cannot be imported and matched to a real person.

### Performance

**[PERF-H1] Serial signed URL creation per patient image** — `patientImagesServer.ts:326–331` loops over images calling `createSignedUrl` one at a time. A patient with 20 images = 20 serial Supabase Storage round-trips. Replace with the batch `createSignedUrls` API.

**[PERF-H2] `PatientDetailPageView` is `'use client'` with no interactive state** — This large layout shell has no `useState` or event handlers. It's client-side only because some leaf children are interactive. Moving the shell to a server component and pushing `'use client'` to leaf nodes would reduce JS bundle and hydration cost.

**[PERF-H3] `select("*")` on wide tables in high-frequency paths**
- `fi_consultations` list query fetches `structured_data jsonb` + `live_notes text` for every row
- `fi_invoices` fetches full rows including `metadata jsonb` + `automation_hints jsonb` for up to 400 records

**[PERF-H4] Missing `(tenant_id, status)` index on `fi_crm_leads`** — CRM pipeline and dashboard queries filter by status; without a composite index this is a full tenant scan.

---

## 🟡 MEDIUM

### Security

**[SEC-M1] `fi_intakes`, `fi_uploads`, `fi_signals`, and 10+ legacy tables have no RLS** — All 20250220-era migrations lack `enable row level security`. While the service role bypasses RLS, if a client-side Supabase query is ever introduced, these tables (containing PII) would be fully readable cross-tenant by the anon key.

**[SEC-M2] `/api/health/iiohr-hr-staff-sync` — no authentication** — Public endpoint passes `process.env` resolver to handler function. Should require Bearer cron secret.

**[SEC-M3] Impersonation cookie uses `sameSite: "lax"` instead of `"strict"`** — `app/api/fi-os/impersonation/start/route.ts:69`. For an elevated-privilege cookie, `strict` is more appropriate.

**[SEC-M4] Staff PIN hashing not confirmed** — `fi_staff_pins` schema needs review to confirm `pin_hash` stores a bcrypt/argon2 hash, not plaintext.

### Code Quality

**[CODE-M1] Dashboard surgery pipeline KPI cards display proxy metrics with TODO labels visible to clinical operators** — `DashboardSurgeryPipeline.tsx:50,52,54`. Proxy numbers should not drive clinical decisions.

**[CODE-M2] `formatMoney` defined 3 times with inconsistent behavior** — `FinancialSurgeryPipelineInline.tsx` uses `en-AU` locale; `CaseRevenuePaymentsCardClient.tsx` and `PatientRevenueInvoicesPanel.tsx` use `toLocaleString` with no locale. AUD 15,000 displays differently across panels. Create `src/lib/format/money.ts`.

**[CODE-M3] 21 server actions use manual type guards instead of Zod** — `lib/actions/fi-consultation-form-actions.ts`, `fi-os-auth-actions.ts`, etc. Inconsistent validation depth; `report_id` not UUID-validated before DB queries.

**[CODE-M4] 30+ `as unknown as` casts on Supabase `.data` in `lib/fi/events/mapping.ts`** — If query shape changes, casts silently hide the mismatch. Use typed Supabase generics or Zod parse before casting.

**[CODE-M5] 3 `fetch` calls in audit review page have no `.catch()`** — `app/(fi-admin)/fi-admin/[tenantId]/audit/[reportId]/page.tsx:40–77`. Network errors silently swallow; spinner clears but user sees no feedback.

### Data Integrity

**[DATA-M1] 716 leads (15.3%) have no Lead Status** — Pipeline state unknown; these will not route correctly during import.

**[DATA-M2] `fi_users.email` and `auth_user_id` are both nullable** — Ghost user rows (no email, no auth link) can accumulate as FK targets across the schema.

**[DATA-M3] Placeholder pharmacy seeded for every tenant** — `pharmacy-orders@example.invalid` is inserted by `20260629120002`. If prescription send is triggered before a real pharmacy is configured, it silently dispatches to a non-existent domain.

**[DATA-M4] `physical_room_key = 'perth_phys_surgery_2'` used for both PRP Room 2 and Surgery 2** — `20260712120005` seed migration collision. Any booking conflict logic treating this key as a physical room identifier will double-book.

**[DATA-M5] `FiCrmActivityEventRow.lead_id` typed as `string | null` in TS but `NOT NULL` in DB** — `src/lib/crm/types.ts`. Type mismatch will mask required-field errors at compile time.

**[DATA-M6] `fi_cases.patient_id` (no FK) and `foundation_patient_id` coexist with no reconciliation** — Two competing patient columns on `fi_cases`; no migration aligns them.

### Performance

**[PERF-M1] 3 sequential independent queries in `listConsultationsForTenant`** — `consultationLoaders.server.ts:391–408`. Should be `Promise.all`.

**[PERF-M2] 4 sequential `fi_bookings` queries in conversion board loader** — `consultationConversionBoardLoader.server.ts:330–350`. Should be `Promise.all`.

**[PERF-M3] `framer-motion` statically imported in global header/footer** — Forces ~160 KB gzipped into the initial JS bundle for all routes.

**[PERF-M4] No `unstable_cache` on slowly-changing data** — Staff lists, services, clinic rooms are re-fetched from DB on every page load. `unstable_cache` with a short TTL would eliminate repeat round-trips.

**[PERF-M5] No composite `(tenant_id, updated_at)` index on `fi_consultations`** — List queries filter by tenant and order by `updated_at`; separate single-column indexes are suboptimal.

---

## 🟢 LOW

### Security
- `NEXT_PUBLIC_FI_CLINIC_OS_SHELL=true` client-visible — intentional feature flag, no sensitive data
- No SQL injection vectors found — Supabase ORM used consistently throughout

### Code Quality
- `document.execCommand("copy")` deprecated in `CopyProcedureDayLinkButton.tsx:45` — replace with `navigator.clipboard.writeText()`
- 5 components exceed 800 lines (`CalendarQuickCreateDrawer.tsx` is 1,383 lines) — refactor targets
- `console.log` blocks in HR import runners in `src/lib/` fire during production cron runs
- `formatWhen` defined independently in 3 component files — create shared `src/lib/format/` module
- `ModelRun.job_id` still in TypeScript types but removed from DB in v2 migration

### Data Integrity
- `latest_report_id` attempted in two migration files (harmless due to `IF NOT EXISTS`)
- `Bad Timing` lead status (2 records) uses freeform string not matching emoji-prefix convention — will produce unmapped pipeline stage
- 14 records have trailing whitespace in name fields
- 4 records have placeholder phone numbers (`0400000000`, `9999999999`, `0000000000`)

### Performance
- `<img>` raw tags for patient thumbnails in 5 components — switch to `<Image>` after adding Supabase storage domain to `next.config.mjs` `remotePatterns`
- `shellFingerprint(shell)` called as expression directly in `useEffect` deps array — memoize it
- API routes missing explicit `Cache-Control: no-store` headers

---

## Positive Findings

- **No Realtime subscriptions** — no unfiltered Supabase Realtime channels found; calendar uses a safe polling/patch model
- **`strict: true` TypeScript** — no `any`, no `@ts-ignore`, no `@ts-nocheck` in app code
- **Server components are the norm** — only 3 of 141 `page.tsx` files are `'use client'`; strong Next.js 14 architecture
- **Zod used consistently in all `app/api/tenants/**` routes** — 20 routes confirmed with `safeParse`
- **No SQL injection** — all DB access uses parameterized Supabase query builder
- **All 4,598 present emails pass RFC format check** — clean email data
- **Zero email duplicates** in the HubSpot CSV
- **Dynamic imports used correctly** for marketing animation components

---

## Priority Action List

| # | Priority | Action |
|---|---|---|
| 1 | 🔴 Today | Rotate: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `SUPABASE_DB_PASSWORD` |
| 2 | 🔴 Today | Check `git log --all -- .env.local`; purge if ever committed |
| 3 | 🔴 Today | Fix Excel-mangled phone numbers in CSV before any import run |
| 4 | 🟠 This week | Add session validation to `middleware.ts` for `/fi-admin/*` routes |
| 5 | 🟠 This week | Add global security headers (CSP, X-Frame-Options, etc.) to `next.config.mjs` |
| 6 | 🟠 This week | Narrow `Access-Control-Allow-Origin: *` to branding assets only |
| 7 | 🟠 This week | Gate `blood_extract` / `image_extract` stubs with feature flag or error; they're writing empty data |
| 8 | 🟠 This week | Add a soft-delete guard before `fi_cases` deletes; the cascade is destructive |
| 9 | 🟠 This week | Enable RLS on all 20250220-era tables (`fi_intakes`, `fi_uploads`, `fi_signals`, etc.) |
| 10 | 🟠 This week | Replace serial `createSignedUrl` loop with batch API call |
| 11 | 🟡 This sprint | Create `src/lib/format/money.ts` — fix inconsistent currency display across revenue panels |
| 12 | 🟡 This sprint | Add `(tenant_id, status)` index to `fi_crm_leads` |
| 13 | 🟡 This sprint | Add `(tenant_id, updated_at)` composite index to `fi_consultations` |
| 14 | 🟡 This sprint | Parallelise independent Supabase queries with `Promise.all` in consultation loaders |
| 15 | 🟡 This sprint | Wrap `framer-motion` in header/footer behind `dynamic()` |
| 16 | 🟡 Backlog | Migrate 21 server actions from manual type guards to Zod schemas |
| 17 | 🟡 Backlog | Resolve `Patient` type mismatch — `full_name`/`email` don't exist in `fi_patients` |
| 18 | 🟡 Backlog | Remove `auditor@hairaudit.com` hardcoded platform admin from production migrations |
| 19 | 🟡 Backlog | Add `Non-Surgical` column to `stg_hubspot_contacts_imports` before import |
| 20 | 🟡 Backlog | Add `unstable_cache` for staff/services/rooms (slowly-changing data) |
