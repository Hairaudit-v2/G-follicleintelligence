# FI OS — Auth and access control production audit

**Scope:** `app/(fi-admin)`, `app/api`, `lib/actions`, `src/lib/fiOs`, `src/lib/crm`, `src/lib/staffPin`, `middleware.ts` (2026-06-12).  
**Note:** There is **no** `lib/auth` package; identity flows through **Supabase Auth**, **`fi_users` / `fi_os_identities`**, **`crmGate`**, **`fiOsPortalGate`**, and **staff PIN** cookies.

---

## Architecture snapshot

1. **Browser FI Admin (`app/(fi-admin)`)** — `assertFiAdminShellAccess`, `assertFiTenantPortalAccess`, `assertFiTenantPortalAccessUnlessStaffPinSession` in `src/lib/fiOs/fiOsPortalGate.server.ts`: in **`NODE_ENV === "production"`**, require Supabase session + FI portal staff or tenant membership (or valid staff PIN where explicitly allowed).
2. **Tenant REST API (`app/api/tenants/...`)** — Predominantly **`assertCrmTenantReadAllowed` / `assertCrmTenantWriteAllowed` / `assertCrmTenantStaffManageAllowed`** from `src/lib/crm/crmGate.ts`, optionally **`FI_ADMIN_API_KEY`** via `x-fi-admin-key`, query `adminKey`, or JSON body.
3. **Legacy / global `/api/fi/*` routes** — Mixed: some use **`checkFiTenantPortalApiAccess`**; the former unauthenticated machine routes **`/api/fi/events`**, **`submit`**, **`uploads`**, **`cases`**, **`partners`**, **`run-model`** are now gated by **`FI_LEGACY_FI_API_ENABLED`** + **`FI_LEGACY_FI_API_SECRET`** (Bearer only). Other paths unchanged (see risk table).
4. **Server actions (`lib/actions`, `src/lib/actions`)** — Rely on **Next server context**; most sensitive actions use **`assertCrmTenantWriteAllowed`** (with `request: undefined` — **session cookies only**, no Bearer in typical client calls unless wired). Foundation actions use **`requireFiAdminKey`** (`lib/server/fiAdminKeyGate.ts`).
5. **Middleware** — `middleware.ts` only sets pathname header and CORS/CORP for static images; **no auth**, no tenant routing.
6. **Impersonation** — `POST /api/fi-os/impersonation/start` requires platform admin role; sets httpOnly cookie (`secure` in production).

---

## Role model (ClinicOS / CRM)

| Construct | Location | Production intent |
|-----------|----------|-------------------|
| CRM mutation roles | `CRM_MUTATION_ROLES_LOWER` in `src/lib/crm/crmGatePolicy.ts` | `fi_admin`, `admin`, `crm_operator`, `owner` may mutate via `assertCrmTenantWriteAllowed` after `resolveDevelopmentClinicAccessForTenant` |
| Staff directory writes | `CRM_STAFF_MANAGE_ROLES_LOWER` | Only `fi_admin`, `admin` (`assertCrmTenantStaffManageAllowed`) |
| `member` | implied | Read paths that only call `assertCrmTenantReadAllowed` — tenant membership sufficient |
| Platform admin | `fi_platform_admin` etc. in `src/lib/fiOs/fiOsRoles.ts` | Full tenant API bypass when not impersonating (`isFiOsPlatformAdminFullSessionBypass`) |
| `tenant_backend` | `fiOsPortalGate.server.ts` | Requires active `fi_tenant_admin_users` row (not suspended); invited → active after email confirmed / sign-in |

**Known product debt:** `src/lib/fiOs/developmentClinicAccess.ts` header still says *“Tighten these sets before production role hardening.”* `crm_operator` retains wide ClinicOS write access by design today.

---

## Service role usage

| Pattern | Risk | Notes |
|---------|------|-------|
| `supabaseAdmin()` in API routes | **High** if route lacks tenant/auth gate | Bypasses RLS; all enforcement must be explicit in route/handler |
| Server actions + `supabaseAdmin` | **Medium** | Depends on prior `assertCrm*` / `requireFiPrescribingActor` / payment gates |

---

## Impersonation

| Item | Assessment |
|------|------------|
| Start endpoint | `POST /api/fi-os/impersonation/start` — requires `resolveAuthUserId` + `isFiOsPlatformAdminRole`; rejects active staff PIN sessions |
| Cookie | HttpOnly, `sameSite: lax`, 8h max-age, `secure` in production |
| Risk | **Medium** — powerful support feature; ensure **audit logging** and **platform admin provisioning** are strictly controlled in Supabase |

---

## Staff PIN (`/api/fi-staff-pin/login`)

| Item | Assessment |
|------|------------|
| Auth | Knowledge factor (PIN); no Supabase user |
| Exposure | Sets clinic session cookie; `assertFiTenantPortalAccessUnlessStaffPinSession` allows floor workflows |
| Risk | **Medium** — brute-force / shoulder surf; ensure rate limits (if any) and PIN rotation policy outside this repo review |

---

## Public or weakly protected endpoints

| Route | Auth | Notes |
|-------|------|-------|
| `POST /api/fi/events` | **Bearer `FI_LEGACY_FI_API_SECRET`** when `FI_LEGACY_FI_API_ENABLED=true`; else **404** | `ingestFiEvent` — still integration-style; rotate secret; prefer network controls or tenant APIs long term |
| `POST /api/fi/submit` | **Bearer** + flag as above | Body `tenant_id` + `case_id`; mutates case state |
| `POST /api/fi/uploads` | **Bearer** + flag as above | Multipart upload to storage + `fi_uploads` |
| `POST /api/fi/cases` | **Bearer** + flag as above | Creates case + intake (PII) |
| `POST /api/fi/partners` | **Bearer** + flag as above | Creates partner row |
| `POST /api/fi/run-model` | **Bearer** + flag as above | Runs pipeline / model |
| `POST /api/fi/copy-check` | **None** | Stateless text validation — **Low** abuse (compute) |
| `GET /api/health/iiohr-hr-staff-sync` | **None** | Aggregate health JSON — **Low** info disclosure (tenant-scoped stats for configured tenant) |
| `POST /api/tenants/[tenantId]/seed` | **403 in production** | Dev-only |
| `checkFiTenantPortalApiAccess` | **Session + tenant** in production; **opt-in bypass** only when **`FI_ALLOW_INSECURE_API`** is `true`/`1`/`yes` **and** `NODE_ENV !== "production"` (`isInsecureFiApiBypassAllowed`) | Same code path as audit/report/global-search/patient-twin — **never** bypass on `NODE_ENV=production` (e.g. Vercel preview) |

---

## Webhook / integration auth (see webhook audit)

| Route family | Mechanism |
|--------------|-----------|
| Timely | `Authorization: Bearer` vs `FI_TIMELY_WEBHOOK_SECRET` |
| IIOHR staff sync | `x-iiohr-sync-secret` vs `IIOHR_HR_SYNC_SECRET` |
| HR cron | `Authorization: Bearer` vs `CRON_SECRET` |
| Reminder cron | Bearer / `x-fi-reminder-secret` vs `FI_REMINDER_CRON_SECRET` |

---

## Risk table

| ID | Area | Risk level | Finding |
|----|------|------------|---------|
| A1 | `/api/fi/events`, `/api/fi/submit`, `/api/fi/uploads`, `/api/fi/cases`, `/api/fi/partners`, `/api/fi/run-model` | **High** (was Critical) | **Mitigated:** routes return **404** unless `FI_LEGACY_FI_API_ENABLED`; when on, require **`Authorization: Bearer`** vs `FI_LEGACY_FI_API_SECRET` (timing-safe). Misconfiguration (enabled, empty secret) → **503**. Still **shared-secret** risk — migrate callers to `/api/tenants/...` + CRM gates. |
| A2 | `checkFiTenantPortalApiAccess` insecure bypass | **Medium** (was High) | **Mitigated:** bypass requires **`FI_ALLOW_INSECURE_API`**; **ignored when `NODE_ENV=production`**. Residual risk if a **public** host runs **`NODE_ENV=development`** with the flag set (misconfiguration). |
| A3 | `FI_ADMIN_API_KEY` in query / header / body | **High** | Shared secret bypasses end-user auth; logging/proxies may leak `adminKey` query param |
| A4 | `crm_operator` wide write surface | **Medium** | Documented development-era breadth; least-privilege not yet enforced per subdomain (PatientOS vs pure CRM) |
| A5 | Staff PIN | **Medium** | Floor kiosk model; depends on PIN strength and lockout (review `verifyStaffPinLogin`) |
| A6 | Impersonation | **Medium** | Platform admins act as tenants; governance + Supabase `fi_os` role assignment |
| A7 | Middleware | **Low** | No security boundary; relies entirely on app routes |
| A8 | Server actions without `request` | **Medium** | Bearer token path on `assertCrmTenant*` not used when `request: undefined` — **cookies only** (expected for same-origin UI, brittle for external API clients) |
| A9 | `POST /api/fi/copy-check` | **Low** | Public compute; no data persistence |

---

## Route inventory summary

| Bucket | Representative paths | Gate |
|--------|------------------------|------|
| Tenant CRM / clinical API | `/api/tenants/[tenantId]/crm/**`, patients, bookings, pathology, … | `assertCrmTenant*` |
| Staff / directory | `/api/tenants/[tenantId]/staff/**` | read vs `assertCrmTenantStaffManageAllowed` |
| ClinicOS search | `.../clinic-os/global-search`, `.../consultations/search-links` | `checkFiTenantPortalApiAccess` |
| FI legacy JSON API | `/api/fi/report`, `/api/fi/audit/*`, `/api/fi/patient-twin/*` | `checkFiTenantPortalApiAccess` |
| FI legacy machine JSON | `/api/fi/events`, `submit`, `uploads`, `cases`, `partners`, `run-model` | **`FI_LEGACY_FI_API_*`** Bearer gate (default off) |
| Cron | `/api/cron/*` | Bearer secrets |
| Timely | `/api/tenants/[tenantId]/integrations/timely/*` | Timely bearer |
| HR | `/api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` | `x-iiohr-sync-secret` + staff PIN mutation guard |
| FI OS | `/api/fi-os/impersonation/*` | Session + platform role |
| Tenants list | `GET /api/tenants` | `resolveFiAdminTenantDirectory` (session; optional dev list) |

---

## Patient data exposure (focus)

- **High (residual):** Legacy `/api/fi/*` create/upload/run-model paths (when enabled) still accept **any** `tenant_id` in JSON if the Bearer secret is known — tenant existence is checked, not caller membership. Prefer tenant-scoped APIs + `assertCrmTenant*`.
- **Tenant APIs:** Generally require membership or admin key; pathology and imaging routes use **`assertCrmTenantWriteAllowed`** or read variants — align product policy (some reads are under “write” gate — verify intentional).
- **Global search / FI JSON APIs:** `checkFiTenantPortalApiAccess` requires a **Supabase session** (or cross-tenant OS role) whenever `NODE_ENV=production`; non-production bypass only with **`FI_ALLOW_INSECURE_API`**.

---

## Recommended follow-ups (patch stage)

1. **Patch PR 1 (done):** shared **`FI_LEGACY_FI_API_SECRET`** + opt-in **`FI_LEGACY_FI_API_ENABLED`** for legacy `/api/fi/*` machine routes. **Next:** network allowlist or mTLS for integrators **or** fold callers under `assertCrmTenant*` + signed JWT and delete these routes.
2. **Patch PR 2 (done):** explicit **`FI_ALLOW_INSECURE_API`** for `checkFiTenantPortalApiAccess` bypass; production ignores it.
3. Remove **`adminKey` from query string** support where possible (headers only).
4. Document **platform admin** provisioning and **impersonation audit** expectations in Supabase.
