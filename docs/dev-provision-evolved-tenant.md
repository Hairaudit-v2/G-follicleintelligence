# Dev: provision Evolved tenant (UK) + reminder templates

Use this when standing up a **local or staging** database so FI Admin has a canonical **Evolved Hair Clinics** row, **UK (Europe/London)** defaults, and starter **`fi_reminder_templates`**.

## One command (recommended)

From the repository root, with **`NEXT_PUBLIC_SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** set (same as `npm run dev` — typically via `.env.local`):

```bash
npm run dev:provision:evolved
```

Optional environment overrides:

| Variable | Default | Purpose |
|----------|---------|---------|
| `FI_EVOLVED_TENANT_SLUG` | `evolved` | `fi_tenants.slug` (lowercase, URL-safe) |
| `FI_EVOLVED_TENANT_NAME` | `Evolved Hair Clinics` | `fi_tenants.name` and `fi_tenant_settings.brand_name` |

The script is **idempotent**:

- Reuses an existing tenant with the same **slug** (no duplicate slug insert).
- **Upserts** `fi_tenant_settings` for `default_timezone = Europe/London` and branding.
- **Skips** reminder inserts if the tenant already has **any** `fi_reminder_templates` rows (delete templates first if you want a full re-seed).

After provisioning, link your Supabase Auth user to the tenant if you need signed-in access (see checklist below).

## Manual checklist (Supabase SQL Editor or `psql`)

Use this when you cannot run Node locally but have SQL access.

1. **Create or confirm tenant**

   ```sql
   insert into fi_tenants (name, slug)
   values ('Evolved Hair Clinics', 'evolved')
   on conflict (slug) do update
     set name = excluded.name, updated_at = now()
   returning id;
   ```

   Note the returned **`id`** as `tenant_id` for the next steps.

2. **UK timezone + brand on `fi_tenant_settings`**

   ```sql
   insert into fi_tenant_settings (tenant_id, brand_name, default_timezone)
   values ('<TENANT_UUID>', 'Evolved Hair Clinics', 'Europe/London')
   on conflict (tenant_id) do update
     set brand_name = excluded.brand_name,
         default_timezone = excluded.default_timezone,
         updated_at = now();
   ```

3. **Seed reminder templates** (only if none exist yet for that tenant)

   Insert rows into `fi_reminder_templates` with valid `type` (`sms` | `email`) and `trigger_event` (see migration `fi_reminder_templates_and_jobs` / `fi_reminders_post_consult_cancelled_error_log`). Merge placeholders supported in app code: `{{patient_name}}`, `{{booking_time}}`, `{{clinic_name}}`, etc. (see `src/lib/reminders/remindersCore.ts`).

4. **Optional: FI OS access**

   - Insert **`fi_users`** linking your `auth.users.id` to `tenant_id` with an appropriate `role`.
   - Or add **`fi_os_identities`** for platform roles (see `docs/fi-os-access-production.md`).

## Related

- Production access, redirects, and **`GET /api/tenants`** rules: **`docs/fi-os-access-production.md`**
- Local tenant list bypass: **`docs/dev-local-fi-admin.md`**
- Post-login redirect for tenant members: **`src/lib/fiOs/fiOsRedirect.server.ts`** (defaults to **`/fi-admin/[tenantId]/cases`**)
