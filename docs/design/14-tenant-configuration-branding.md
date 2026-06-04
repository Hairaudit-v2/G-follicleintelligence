# Tenant Configuration & Branding (Stage 1K)

## Purpose

Stage 1K introduces **additive database tables** and **read-only loaders** so each **tenant**, **organisation**, and **clinic** can eventually own:

- Visual branding (name, logo URL, colour palette)
- Contact and support defaults
- Public operational URLs (booking, intake) at clinic level
- Open-ended **`metadata` JSON** for future CRM, consent, pricing, and workflow configuration

This stage **does not** implement a full CRM or public CMS. It establishes the **foundation**, loaders, cascade resolution, and an **FI Admin** configuration surface (read overview in 1K; **editable** settings in Stage 1L — see [15-configuration-admin-editing.md](./15-configuration-admin-editing.md)).

## Cascade model

Effective branding is computed in **`resolveEffectiveBranding`** with this precedence:

1. **Tenant** (`fi_tenant_settings`) — baseline brand colours, logo, brand name, support email, default timezone.
2. **Organisation** (`fi_organisation_settings`) — overrides tenant for brand fields where set; adds **website URL** and organisation-level support email.
3. **Clinic** (`fi_clinic_settings`) — does **not** store colour fields; it contributes **display name** (which, when set, overrides the cascaded **brand name** for public-facing labelling), **booking URL**, **public intake URL**, phone, email, address, and **timezone** (clinic timezone wins over tenant default timezone for the effective default).

Colours always flow **organisation → tenant** (clinic tier has no colour columns in this schema).

Support email effective value uses **organisation → tenant** (clinic **email** is exposed separately as **clinic email** in the effective object, not mixed into `support_email`).

## Multi-tenant behaviour

- All tables are scoped with **`tenant_id`** referencing `fi_tenants`.
- **Organisation** and **clinic** settings reference their parent entities with uniqueness **`(tenant_id, organisation_id)`** and **`(tenant_id, clinic_id)`** so each entity has at most one settings row per tenant.
- **RLS** follows the same conservative pattern as other foundation tables: **`authenticated`** users may **SELECT** rows where they are a member of the tenant (`fi_users.auth_user_id = auth.uid()` and matching `tenant_id`). **Service role** continues to bypass RLS for server-side FI Admin loaders.
- No vendor-specific defaults are seeded in migrations; each tenant’s data is independent.

## Editing status

- Migrations create tables and RLS **select** policies for **authenticated** members (no authenticated INSERT/UPDATE policies on these settings tables).
- FI Admin **Configuration** loads via **service role** on the server. **Stage 1L** adds FI-admin-gated server actions and edit forms; see [15-configuration-admin-editing.md](./15-configuration-admin-editing.md).

## Future: richer admin and roles

Planned follow-ups may include:

- Role-based editing (tenant admin vs org admin vs clinic manager) with RLS write policies instead of a shared ops key.
- Audit logs, stricter URL allowlists, and logo storage integration.
- Versioned settings or publish/draft workflow for white-label rollouts.

## White-label CRM / CMS

The cascade allows a **parent organisation** to define a shared palette while **clinics** override public URLs and local contact details—supporting multi-site operators without hard-coding any single company. **`metadata`** on each table is reserved for future structured CRM configuration (pipelines, document templates, consent text references) without schema churn for every new field.

## Related code

- Migration (tables): `supabase/migrations/20260606120001_fi_tenant_org_clinic_settings.sql`
- Migration (service_role writes): `supabase/migrations/20260606130001_fi_settings_service_role_write.sql`
- Loaders & upserts: `src/lib/fi/foundation/tenantSettings.ts`
- Server actions: `lib/actions/fi-configuration-actions.ts`
- UI: `src/components/fi/TenantConfigurationPanel.tsx`, `src/components/fi/FiTenantBrandFrame.tsx`
- Route: `/fi-admin/[tenantId]/configuration`

See also: [06-foundation-layer-architecture.md](./06-foundation-layer-architecture.md), [11-universal-patient-record.md](./11-universal-patient-record.md), [15-configuration-admin-editing.md](./15-configuration-admin-editing.md), [16-effective-branding-application.md](./16-effective-branding-application.md).
