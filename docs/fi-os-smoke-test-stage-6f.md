# FI OS — Stage 6F final smoke test & release checklist

**Status:** Official pre-launch checklist for FI OS after module rollout (e.g. FoundationOS in shell nav) and production hardening (e.g. AnalyticsOS `loadNotes` sanitisation, global search error hygiene, access documentation).

**Related:** [fi-os-access-production.md](./fi-os-access-production.md) (production gates, shell rollout, global search API, cross-tenant OS roles), [design/19-fi-os-current-state-and-dashboard-roadmap.md](./design/19-fi-os-current-state-and-dashboard-roadmap.md) (route and gate survey).

---

## Scope

- **In scope:** Follicle Intelligence **FI Admin / FI OS** tenant workspace under `/fi-admin` and `/fi-admin/[tenantId]/*`, including optional **Clinic OS shell** (`NEXT_PUBLIC_FI_CLINIC_OS_SHELL`), **global search**, CRM shell (**LeadFlow**), bookings operator surfaces (**PatientOS**, board/calendar), **SurgeryOS**, **AuditOS**, **FoundationOS**, **AnalyticsOS**, **Settings** (staff/services/configuration/reminders), and **role-based** nav vs route access.
- **Out of scope:** HairAudit hub-only flows unless you explicitly extend this checklist; database migrations and RLS changes (validate separately); third-party ESP/SMS unless reminder delivery is in scope for this release.

---

## Environment requirements

| Requirement | Notes |
|-------------|--------|
| **`NODE_ENV=production`** | HTML route gates (`assertFiAdminShellAccess`, `assertFiTenantPortalAccess`, …) and production-only `/api/tenants` staff checks use **strict** `NODE_ENV === 'production'`. Validate on **`next build` + `next start`** or your staging host — not plain `next dev`. |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set for the deployment. |
| **Clinic OS shell (if enabled)** | `NEXT_PUBLIC_FI_CLINIC_OS_SHELL=true` must be set **before `next build`** and deployed consistently (server + client bundles). Same flag gates `GET /api/tenants/[tenantId]/clinic-os/global-search`. |
| **Auth** | Supabase Auth redirect URLs include your OS login and password recovery paths (see `fi-os-access-production.md`). |
| **Optional** | `FI_ADMIN_API_KEY`, reminder cron (`FI_REMINDER_CRON_SECRET`), Resend/Twilio vars — only if those features are in this release. |

---

## Required test users / roles

Provision **distinct Auth users** (or sequential sign-ins) so each row can be exercised without role bleed.

| Persona | `fi_os_identities` | `fi_users` (tenant) | Purpose |
|---------|-------------------|---------------------|--------|
| **A — Tenant member (plain)** | None | `member`, no active `fi_staff` | Default portal; no CRM shell; no PatientOS; Staff nav hidden in legacy bar unless bookings-eligible |
| **B — Bookings operator** | None | `member` + **active** `fi_staff` for tenant | `getBookingsBoardNavAllowed` / PatientOS layout; board/calendar where gated |
| **C — CRM operator** | None | `crm_operator` (or `admin` / `fi_admin` per policy) | LeadFlow, CRM mutations, Staff link visibility where applicable |
| **D — Cross-tenant `fi_admin`** | `fi_admin` | Optional / any | All tenants in picker (when staff); any tenant URL without per-tenant `fi_users` row |
| **E — Cross-tenant `fi_auditor`** | `fi_auditor` | Optional | HairAudit redirect on login; cross-tenant directory behaviour per `fi-os-access-production.md` |
| **F — Non–portal user** | None | None | Negative: 403 / redirects on `/fi-admin` and tenant routes in production |

Exact role strings and CRM shell set are defined in `src/lib/crm/crmGatePolicy.ts` and `docs/fi-os-access-production.md`.

---

## Smoke test matrix (official checklist)

Execute in order on the **target production-like** environment. Record **Pass / Fail / Skip** and notes in the pass/fail table below.

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Login** | Open `/follicle-intelligence/login` (or `/fi-login` redirect). Sign in succeeds; invalid credentials rejected; `next` redirect is same-origin safe. |
| 2 | **Tenant picker** | `/fi-admin` loads; tenant list matches role (subset vs all tenants); unauthenticated behaviour matches prod (401/403) or documented dev fallback. |
| 3 | **Tenant home** | Navigate to `/fi-admin/[tenantId]`. Page loads or shows clear misconfiguration notice if env missing; operational dashboard content renders without server error. |
| 4 | **ClinicOS shell** | If shell enabled: light workspace chrome, FI branding, horizontal module nav. If disabled: legacy `FiAdminTenantNav` still allows module access. |
| 5 | **Global search** | Open search (⌘K / Ctrl+K in shell). Query with ≥2 characters: results or empty state; no uncaught errors. If shell flag off on server build: user sees clear message (not a generic stack). |
| 6 | **LeadFlow** | As persona **C**: `/fi-admin/[tenantId]/crm` loads, list or empty state OK. As **A** without CRM: CRM routes redirect or deny per layout. |
| 7 | **PatientOS** | As **B** or **C**: `/fi-admin/[tenantId]/patients` loads. As **A** (plain member): expect redirect/deny consistent with `getBookingsOperatorPageSession`. |
| 8 | **SurgeryOS** | `/fi-admin/[tenantId]/cases` worklist loads; open one case detail if data exists; no 500. |
| 9 | **AuditOS** | `/fi-admin/[tenantId]/audit` loads; optional `/audit/[reportId]` if you have fixture IDs. |
| 10 | **FoundationOS** | `/fi-admin/[tenantId]/foundation-integrity` loads. In shell: **FoundationOS** tab active; not listed under Settings. |
| 11 | **AnalyticsOS** | `/fi-admin/[tenantId]/analytics` loads. If a submodule fails server-side: **production** UI shows generic load notes (no raw SQL/path strings). |
| 12 | **Settings** | Open Services, Configuration, Reminders; Staff when nav shows it. Read paths OK; writes only with expected key/role (spot-check, no destructive bulk). |
| 13 | **Role-based visibility** | For each persona, confirm **nav links** and **disabled shell tabs** match `crmShellAccess` + `clinicOsShellConfig` / `FiAdminTenantNav` (CRM-only vs bookings-only vs neither). |
| 14 | **Cross-tenant `fi_admin` / `fi_auditor`** | As **D**/**E**: open a tenant you are **not** `fi_users`-joined to; confirm allowed or denied exactly as `assertFiTenantPortalAccess` + docs. Confirm `GET /api/tenants` list width. |
| 15 | **PatientOS / bookings operator** | As **B**: confirm PatientOS and bookings surfaces without CRM role. As **A**: confirm PatientOS denied. |
| 16 | **`/bookings/new` appointment entry** | Open `/fi-admin/[tenantId]/bookings/new`. “Book from lead” enabled only when CRM shell; “Book from existing patient” may be disabled if still “Coming soon” — record as product state, not infra failure. |
| 17 | **Production env variables** | Host/CI env matches checklist in **Environment requirements**; no secrets in client bundle beyond `NEXT_PUBLIC_*`. |
| 18 | **Docs alignment** | Spot-check `fi-os-access-production.md` validation §1–11 and this matrix for any last-minute route renames. |

**Path note:** There is no separate route slug `appointment-request`; the supported **appointment entry** path is **`/fi-admin/[tenantId]/bookings/new`**.

---

## Pass / fail table

| # | Area | Result | Tester | Date | Notes |
|---|------|--------|--------|------|-------|
| 1 | Login | | | | |
| 2 | Tenant picker | | | | |
| 3 | Tenant home | | | | |
| 4 | ClinicOS shell | | | | |
| 5 | Global search | | | | |
| 6 | LeadFlow | | | | |
| 7 | PatientOS | | | | |
| 8 | SurgeryOS | | | | |
| 9 | AuditOS | | | | |
| 10 | FoundationOS | | | | |
| 11 | AnalyticsOS | | | | |
| 12 | Settings | | | | |
| 13 | Role-based visibility | | | | |
| 14 | Cross-tenant fi_admin / fi_auditor | | | | |
| 15 | PatientOS / bookings operator | | | | |
| 16 | /bookings/new | | | | |
| 17 | Production env variables | | | | |
| 18 | Docs alignment | | | | |

**Automated regression (CI):** run `npm run test:unit` on the release commit; record pass/fail in release notes (does not replace rows 1–18).

---

## Remaining blockers

Use this section during the test run to capture **must-fix before launch** items.

| ID | Blocker | Owner | Status |
|----|---------|-------|--------|
| B1 | | | |
| B2 | | | |

**Known non-blockers / caveats**

- **`next dev`:** API `checkFiTenantPortalApiAccess` for global search **does not** enforce session when `NODE_ENV !== 'production'` — do not treat dev API behaviour as production security.
- **Product placeholders:** e.g. “Book from existing patient” on `/bookings/new` may remain **Coming until** a future release.

---

## Launch recommendation

- **Go / no-go** must be decided only after rows **1–17** are **Pass** (or **Skip** with documented scope) for the **production-like** environment and build that will serve users.
- **Minimum bar for internal staff rollout:** all OS modules reachable for at least one positive persona each; negative personas confirm **deny/redirect**; global search and shell flag **aligned** on one deploy artifact.
- Record **git SHA**, **environment name**, and **tester** on the signed pass/fail table (or attach to the release ticket).

---

## Rollback plan

| Scenario | Action |
|----------|--------|
| **Shell or search regression** | Redeploy a build with **`NEXT_PUBLIC_FI_CLINIC_OS_SHELL` unset or not `true`** (requires **rebuild**). Layout falls back to legacy nav; global search API returns `FI_CLINIC_OS_SHELL_DISABLED`. |
| **General FI Admin regression** | Roll host/deploy to last **known-good** application revision; avoid reverting DB migrations without a separate DBA plan. |
| **Auth / Supabase misconfig** | Fix forward (redirect URLs, keys); rollback app only if login still broken after env fix. |
| **Communications** | Share fallback URL `/fi-admin/[tenantId]/cases` for users if home or shell is broken post-deploy. |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-------------|
| Engineering | | | |
| Product / Ops | | | |
