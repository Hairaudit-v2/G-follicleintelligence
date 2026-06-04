# Configuration admin editing (Stage 1L)

## Purpose

Stage 1L allows **Follicle Intelligence (FI) internal admins** to **create and update** foundation configuration rows from the FI Admin **Configuration** page (`/fi-admin/[tenantId]/configuration`):

- `fi_tenant_settings`
- `fi_organisation_settings`
- `fi_clinic_settings`

Edits support **white-label branding** and **public operational URLs** without exposing the Supabase service role to the browser and without granting authenticated users INSERT/UPDATE on these tables.

## Editable fields

### Tenant (`fi_tenant_settings`)

| Field | Notes |
| --- | --- |
| `brand_name` | Display / brand name (optional). |
| `logo_url` | Optional; must be `http://` or `https://` when set. |
| `primary_colour`, `secondary_colour`, `accent_colour` | Optional; hex only: `#rgb` or `#rrggbb`. |
| `support_email` | Optional; simple email shape check. |
| `default_timezone` | Optional; restricted character set (IANA-style identifiers). |

`metadata` is **not** edited from this UI; existing JSON is left unchanged on update and defaults to `{}` on insert via the database.

### Organisation (`fi_organisation_settings`)

Same branding and support fields as tenant, plus:

| Field | Notes |
| --- | --- |
| `website_url` | Optional; `http://` or `https://` when set. |

### Clinic (`fi_clinic_settings`)

| Field | Notes |
| --- | --- |
| `display_name` | Optional override for cascade brand labelling. |
| `booking_url`, `public_intake_url` | Optional; `http://` or `https://` when set. |
| `phone` | Optional short text. |
| `email` | Optional clinic email. |
| `address` | Optional multi-line text (bounded length). |
| `timezone` | Optional; same character rules as tenant default timezone. |

Clinic rows do **not** store colour columns in this schema; colours continue to cascade from organisation → tenant.

## Access control

1. **Route**: FI Admin UI is internal-only (not indexed; see layout metadata). It is **not** a substitute for full RBAC; network and deployment policy should restrict who can open FI Admin.
2. **Mutation gate**: Every server action compares the submitted `adminKey` to the environment variable **`FI_ADMIN_API_KEY`**. If the env var is unset or the key does not match, the action returns a generic error and performs **no** database write.
3. **Service role**: All reads used for validation and all writes use **`supabaseAdmin()`** (Supabase **service role** key) **only on the server**. The browser never receives the service role key.
4. **No client Supabase writes**: The React panel calls **Next.js server actions** only; there are no direct `insert`/`update` calls from the client SDK.

## Database privileges

Migration `20260606130001_fi_settings_service_role_write.sql` grants **`INSERT` and `UPDATE`** on the three settings tables to **`service_role`** only. **Authenticated** users retain **SELECT** via existing RLS policies; there are still **no** authenticated INSERT/UPDATE policies on these tables.

## Validation and multi-tenant safety

- **`tenantId`**: Must be a syntactically valid UUID and must exist in `fi_tenants` before any write.
- **`organisationId`**: Must be a valid UUID and must appear in `fi_organisations` with **`tenant_id` equal to the route tenant**. Otherwise the action returns **“Organisation not found for this tenant.”** This blocks cross-tenant edits even if IDs are guessed.
- **`clinicId`**: Same pattern against `fi_clinics` and the route **`tenant_id`**.
- **Field validation**: Length limits, control-character rejection on free text, URL scheme checks, hex colour checks, and a minimal email pattern reduce garbage and accidental unsafe payloads. Errors are returned as **user-visible strings**; stack traces and secrets are not exposed.

## UX

- A single **admin key** field (password input) is held in component state and sent with each save; it is **not** persisted in localStorage or cookies by this UI.
- **Success** and **error** messages appear inline per form; on success the page triggers **`router.refresh()`** so the read-only “Current” columns reflect the new data.

## Future: role-based admin editing

Planned follow-ups may include:

- **Tenant-scoped roles** (tenant admin, org admin, clinic manager) backed by `fi_users` or a dedicated permissions table, with RLS **INSERT/UPDATE** policies instead of a shared ops key.
- **Audit log** rows for each change (who, when, before/after snapshot).
- Richer validation (e.g. logo upload to object storage, allowlist of domains, publish/draft workflow).

## Related code

- Server actions: `lib/actions/fi-configuration-actions.ts`
- Loaders and upsert helpers: `src/lib/fi/foundation/tenantSettings.ts`
- UI: `src/components/fi/TenantConfigurationPanel.tsx`
- Migration (tables): `supabase/migrations/20260606120001_fi_tenant_org_clinic_settings.sql`
- Migration (service_role writes): `supabase/migrations/20260606130001_fi_settings_service_role_write.sql`

See also: [14-tenant-configuration-branding.md](./14-tenant-configuration-branding.md), [16-effective-branding-application.md](./16-effective-branding-application.md).
