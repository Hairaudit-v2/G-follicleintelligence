# Provision Evolved Hair Clinics tenant (AU + Clinic OS)

Use this when standing up **local, staging, or production** so you have:

- **`fi_tenants`** — org display name is `name` (there is no `org_name` column); canonical slug `evolved`.
- **`fi_tenant_settings`** — `default_timezone = Australia/Perth`, brand colours, support email.
- **`fi_crm_pipeline_stages`** — default `hair_restoration_default` funnel (same slugs/labels as app lazy-seed).
- **`fi_reminder_templates`** — three email templates: **24h** (`booking_24h_before`), **48h** (`booking_48h_before`), **post-consult** (`post_consult`).
- **`fi_users`** — three `crm_operator` seed rows (null `auth_user_id` until you link Supabase Auth).

## Option A — Node script (recommended)

From the repository root, with **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** set (same as `npm run dev`, e.g. `.env.local`):

```bash
npm run dev:provision:evolved
```

Source: **`scripts/provision-evolved-tenant.ts`**

Optional environment overrides:

| Variable | Default | Purpose |
|----------|---------|---------|
| `FI_EVOLVED_TENANT_SLUG` | `evolved` | `fi_tenants.slug` |
| `FI_EVOLVED_TENANT_NAME` | `Evolved Hair Clinics` | `fi_tenants.name` + `fi_tenant_settings.brand_name` |
| `FI_EVOLVED_DEFAULT_TIMEZONE` | `Australia/Perth` | `fi_tenant_settings.default_timezone` |

Idempotency:

- Reuses tenant by **slug**.
- **Upserts** `fi_tenant_settings`.
- Inserts CRM stages only when the tenant has **no** default-scope rows for `hair_restoration_default`.
- Inserts reminder templates only when the tenant has **zero** templates (delete templates first to re-seed).
- Inserts each seed **`fi_users`** row only if that **email** is not already present for the tenant.

## Option B — Raw SQL (staging / prod / SQL Editor)

Run the full script (single transaction):

**`docs/sql/provision-evolved-hair-clinics-tenant.sql`**

Adjust slug/name literals in that file if you use a non-`evolved` slug.

## Clinic OS shell + navigation

The FI Admin tenant layout uses **`ClinicOsShell`** (`app/(fi-admin)/fi-admin/[tenantId]/layout.tsx`). Primary tabs are defined in **`src/lib/fiAdmin/clinicOsShellConfig.ts`**:

| Tab | Route under `/fi-admin/[tenantId]/` | Notes |
|-----|-------------------------------------|--------|
| Dashboard | `/fi-admin/[tenantId]` | Home |
| Calendar | `calendar` | Operational calendar |
| Patients | `patients` | Patient directory |
| Consultations | `consultations` | |
| Cases | `cases` | Clinical / hair-audit cases |
| Sales | `crm` | **Enabled** when `getCrmShellNavAllowed` is true — roles **`fi_admin`** or **`crm_operator`** on `fi_users` |

Placeholder items (Messages, Reports, Training) render disabled. **Sales / pipeline** requires a CRM shell role; seed `fi_users` with `crm_operator` and set **`auth_user_id`** to your `auth.users.id` so the operator can sign in.

## After provisioning

1. Create Supabase **Auth** users for real testers (or use magic link).
2. **`update fi_users set auth_user_id = '<uuid>' where email = '...'`** for each operator you want to log in.
3. Post-login behaviour and OS roles: **`docs/fi-os-access-production.md`**, **`src/lib/fiOs/fiOsRedirect.server.ts`**.

## Related

- Local tenant list bypass: **`docs/dev-local-fi-admin.md`**
- CRM pipeline defaults (code): **`src/lib/crm/pipelineSeedPayload.ts`**
