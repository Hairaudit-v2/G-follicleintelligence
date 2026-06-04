# Follicle Intelligence OS — production access rules

This document describes **how access works in production** (`NODE_ENV === 'production'`) and how to **validate** a deployment. All enforcement is **server-side** (Next.js layouts, route handlers, and `SUPABASE_SERVICE_ROLE_KEY` reads). The browser never receives a trusted “is admin” flag from `fi_os_identities`.

## Roles and tables

| Layer | Storage | Used for |
|--------|---------|----------|
| **Platform OS** | `fi_os_identities` (`auth_user_id`, `os_role`) | Cross-tenant directory (`fi_admin`, `fi_auditor`), post-login redirects, HairAudit OS hub. |
| **Tenant membership** | `fi_users` (`tenant_id`, `auth_user_id`, `role`) | Tenant-scoped FI Admin, CRM gates, `/api/tenants` subset when not cross-tenant OS. |

**FI portal staff** = has a row in `fi_os_identities` **or** at least one row in `fi_users` for the auth user.

Allowed `fi_os_identities.os_role` values: `fi_admin`, `fi_auditor`, `fi_clinic_admin`, `fi_doctor`, `fi_nurse`, `fi_consultant`.

## Route guards (production only)

Guards live in `src/lib/fiOs/fiOsPortalGate.server.ts`. When `NODE_ENV !== 'production'`, these functions **return immediately** so local `next dev` workflows (including `FI_ENABLE_DEV_ADMIN_ACCESS`) stay usable.

| Surface | Rule |
|---------|------|
| **`/fi-admin` shell** | `assertFiAdminShellAccess`: session required; must be FI portal staff. |
| **`/fi-admin/[tenantId]/…`** | `assertFiTenantPortalAccess`: session required; tenant must exist; user must be **`fi_admin` or `fi_auditor` OS** (any tenant) **or** have **`fi_users`** for that `tenant_id`. |
| **`/hair-audit/admin`** | `assertHairAuditOsAdminAccess`: session required; OS role **`fi_admin`** or **`fi_auditor`** only. |

Unauthenticated users are sent to `/follicle-intelligence/login?next=…` with a safe internal `next` path. Non–portal-staff authenticated users hitting `/fi-admin` are redirected with `notice=no_fi_access`.

## Post-login redirects (server)

Implemented in `src/lib/fiOs/fiOsRedirect.server.ts` (after `fiOsPasswordSignInAction` sets cookies). The `next` form field is only honoured if it is a **relative path** starting with `/` and not `//` (open redirect hardening).

| Condition | Redirect |
|-----------|-----------|
| OS `fi_auditor` | `/hair-audit/admin` |
| OS `fi_admin` | `/fi-admin` |
| OS `fi_clinic_admin` / `fi_doctor` / `fi_nurse` / `fi_consultant` | First `fi_users` tenant → `/fi-admin/[tenantId]/cases`, else `/fi-admin` |
| No OS row | First `fi_users` tenant → `/fi-admin/[tenantId]/cases`, else `/fi-admin` |

## `GET /api/tenants`

Implemented in `src/lib/fiAdmin/fiAdminTenantDirectory.ts`.

| Environment | Caller | Result |
|-------------|--------|--------|
| **Production** | No session | **401** `AUTH_REQUIRED` |
| **Production** | Session, **not** FI portal staff | **403** `FI_PORTAL_FORBIDDEN` |
| **Production** | Session, staff, OS `fi_admin` or `fi_auditor` | **200**, `tenants` = **all** `fi_tenants` rows |
| **Production** | Session, staff, no cross-tenant OS role | **200**, `tenants` = tenants linked via `fi_users` only |
| **Non-production** | No session, `FI_ENABLE_DEV_ADMIN_ACCESS=true` | **200**, all tenants + `devTenantListFallback: true` |
| **Non-production** | No session, flag off | **401** |

So **full tenant list is only returned** for authenticated **`fi_admin` / `fi_auditor`** OS users (or dev fallback when unauthenticated).

## Auth aliases and robots

- **`/fi-login`** performs a **server redirect** (Next `redirect()`) to **`/follicle-intelligence/login`**, preserving `next`, `error`, and `notice` query params (`app/fi-login/page.tsx`).
- **`app/robots.ts`** disallows OS and FI Admin paths (including `/fi-admin` and `/fi-admin/` and `/hair-audit` prefixes) so crawlers do not index staff entry points.

## Password recovery (deployed domain)

- **Forgot password** uses `resetPasswordForEmail` with `redirectTo` built from the **incoming request** (`X-Forwarded-Host` / `Host` and `X-Forwarded-Proto`), taking the **first** value when headers are comma-separated (common behind proxies). If headers are missing (rare in server actions), **`NEXT_PUBLIC_SITE_URL`** is used, then `http://localhost:3000`.
- **Supabase Dashboard → Authentication → URL configuration**: add your production site origin and allow the path **`/follicle-intelligence/update-password`** (or use wildcard redirect URLs per Supabase docs).
- **`/follicle-intelligence/update-password`** uses the browser Supabase client with `detectSessionInUrl` / PKCE so the recovery session can be established from the email link.

## Sign out

- **FI Admin** header: form posts **`fiOsSignOutAction`** (clears Supabase cookies, redirects to `/follicle-intelligence/login`).
- **HairAudit admin** footer: same action.

## NODE_ENV and bypass

- **Access checks** (`assertFiAdminShellAccess`, `assertFiTenantPortalAccess`, `assertHairAuditOsAdminAccess`) and **production-only `/api/tenants` staff check** all depend on **`process.env.NODE_ENV === 'production'`** (string equality). They do **not** use `VERCEL_ENV` or other flags.
- **`FI_ENABLE_DEV_ADMIN_ACCESS`** is ignored when `NODE_ENV === 'production'` (see `isFiDevTenantListFallbackEnabled()` and `resolveFiAdminTenantDirectory`).

Therefore a **production-like** build is **`next build` + `next start`** (or a host that sets `NODE_ENV=production`). Plain `next dev` is **not** production-like for these gates.

---

## Validation checklist (run after deploy / before go-live)

### 1–2. Supabase Auth user and `fi_os_identities` (SQL editor, service role or dashboard)

Confirm the auditor exists:

```sql
select id, email, email_confirmed_at
from auth.users
where lower(email) = lower('auditor@hairaudit.com');
```

Confirm platform row (migration seed):

```sql
select i.auth_user_id, i.os_role, u.email
from fi_os_identities i
join auth.users u on u.id = i.auth_user_id
where lower(u.email) = lower('auditor@hairaudit.com');
```

Expect **`os_role = fi_admin`**. If the user was created **after** the migration ran, insert or upsert manually:

```sql
insert into fi_os_identities (auth_user_id, os_role)
select id, 'fi_admin'
from auth.users
where lower(email) = lower('auditor@hairaudit.com')
on conflict (auth_user_id) do update
  set os_role = excluded.os_role, updated_at = now();
```

### 3. `/fi-login`

Open `/fi-login` in the browser; you should land on **`/follicle-intelligence/login`** (address bar updates).

### 4. Login redirects

With **`NODE_ENV=production`** (e.g. `next start`):

| Account setup | Expected first navigation after sign-in |
|----------------|----------------------------------------|
| OS `fi_admin` | `/fi-admin` |
| OS `fi_auditor` | `/hair-audit/admin` |
| OS clinic role or member via `fi_users` only | `/fi-admin/[tenantId]/cases` for first membership row |

### 5. Non-authorised access

While **not** signed in (or signed in as a Supabase user **without** `fi_users` or `fi_os_identities`):

- `/fi-admin` → redirect to OS login with `next=/fi-admin`.
- `/fi-admin/[tenantId]/cases` → redirect to login with `next=/fi-admin/{tenantId}/cases`.
- `/hair-audit/admin` → redirect to login with `next=/hair-audit/admin`.

Signed-in but **wrong tenant** (no membership, not `fi_admin`/`fi_auditor` OS): redirect with `notice=no_tenant_access`.

### 6. Forgot / update password

- From production URL, use **Forgot password**; email should link to **`https://<your-domain>/follicle-intelligence/update-password`** (or your configured public URL). Confirm Supabase **Redirect URLs** allow that URL.
- Complete password change; then sign in again.

### 7. `/api/tenants`

- As **`fi_admin` / `fi_auditor`**: JSON `tenants` length should match all `fi_tenants` rows.
- As tenant-only staff: only linked tenants.
- As authenticated but non-provisioned user in production: **403** and `code: FI_PORTAL_FORBIDDEN`.

### 8. `robots.txt`

Fetch `/robots.txt` and confirm **disallow** entries include FI Admin, API, OS login, forgot/update password, and HairAudit paths.

### 9. Sign out

From `/fi-admin` and `/hair-audit/admin`, submit **Sign out**; session should clear and OS login should load.

### 10. `NODE_ENV`

- **Production behaviour** is keyed off **`process.env.NODE_ENV === 'production'`** only. `next start` (and typical PaaS deploys) set this; **`next dev` does not**, so HTML route guards and the **`/api/tenants` staff check** are **off** in dev (HTML stays open for local workflows; API still follows authenticated branches without the production-only 403-for-non-staff rule).
- To validate **production-like** access end-to-end, use **`next build` + `next start`** (or your staging environment with `NODE_ENV=production`) and re-run checks **5–7** and **9**.

---

## Related files

| Concern | Location |
|---------|-----------|
| OS sign-in / forgot / reset | `lib/actions/fi-os-auth-actions.ts`, `app/follicle-intelligence/**` |
| Login UI | `src/components/fi/os/FiOsLoginScreen.tsx` |
| Gates | `src/lib/fiOs/fiOsPortalGate.server.ts` |
| Redirects | `src/lib/fiOs/fiOsRedirect.server.ts` |
| Tenant API | `src/lib/fiAdmin/fiAdminTenantDirectory.ts`, `app/api/tenants/route.ts` |
| Migration | `supabase/migrations/20260614120001_fi_os_identities.sql` |
| Local dev bypass | `docs/dev-local-fi-admin.md` |
