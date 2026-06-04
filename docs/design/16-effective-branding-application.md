# Effective branding in FI Admin (Stage 1M)

## Purpose

Stage 1M applies **`resolveEffectiveBranding()`** output to the **FI Admin** tenant area so navigation and headers reflect **tenant / organisation / clinic settings** (`fi_tenant_settings`, `fi_organisation_settings`, `fi_clinic_settings`) without hard-coding any partner or clinic identity in code.

## Components

### `FiTenantBrandFrame`

File: **`src/components/fi/FiTenantBrandFrame.tsx`** (client component).

| Variant | Where used | Data source |
| --- | --- | --- |
| **`layout` (default)** | `app/(fi-admin)/fi-admin/[tenantId]/layout.tsx` | `resolveEffectiveBranding({ tenantId })` — tenant baseline only (no query params in layout). |
| **`page-preview`** | Configuration page when `organisationId` and/or `clinicId` query params are present | Same `resolveEffectiveBranding` call as the page already uses, including org/clinic IDs for cascade preview. |

Displayed elements:

- **Logo** — only if `logo_url` passes server-side style rules mirrored in **`safeLogoUrlForImg`** (`http`/`https`, length cap). `<img>` uses **`onError`** to hide a broken image so missing or bad URLs do not break the UI.
- **Brand name** — from `effective.brand_name`, or neutral **`FI Admin`** when unset (no vendor-specific marketing copy).
- **Support email** — optional; rendered as `mailto:` when present, with `encodeURIComponent` for the address portion.
- **Clinic line** — optional; shows **`Clinic:`** + `effective.clinic_display_name` when non-empty (typically when a clinic participates in the resolved cascade, e.g. configuration preview with `clinicId`).

### CSS variables

File: **`src/lib/fi/foundation/brandingCss.ts`**.

Validated hex colours (`#rgb` / `#rrggbb`) are exposed as:

- `--fi-brand-primary`
- `--fi-brand-secondary`
- `--fi-brand-accent`

Invalid or missing colours fall back to neutral greys / blue (**`FI_ADMIN_NEUTRAL_*`**), not tenant-specific hard-coded brand names.

Navigation links under the layout frame use **`hover:text-[color:var(--fi-brand-accent)]`** so hover accents respect the same variables.

### Headline contrast

The main title uses **`text-gray-900`** for readability. Accent colour is used for the **left border bar**, **support link**, and **nav hover** — not as the primary headline fill, so low-contrast brand hex values do not reduce legibility on white backgrounds.

## Fallback behaviour

- **Missing Supabase env** in layout: skip `resolveEffectiveBranding`; use an in-memory **neutral** `EffectiveBranding` object (all `null` fields).
- **Errors** (network/DB): same neutral object; page still renders.
- **Missing settings rows**: `resolveEffectiveBranding` already yields nulls; frame shows **FI Admin** and no logo/email/clinic line as appropriate.

## Safety

- **Colours**: only strings matching **`#` + 3 or 6 hex digits** are applied; anything else maps to neutral fallbacks.
- **Logo URL**: only `http://` / `https://` schemes, length limited; broken images hidden client-side.
- **Support mailto**: built with **`encodeURIComponent`** on the email value.
- **No Evolved-specific defaults**: fallback label is generic **`FI Admin`**; neutral palette constants live in **`brandingCss.ts`**.

## Related code

- `src/lib/fi/foundation/tenantSettings.ts` — `resolveEffectiveBranding`, `EffectiveBranding`
- `src/lib/fi/foundation/brandingCss.ts` — validation + CSS variable builder
- `src/components/fi/FiTenantBrandFrame.tsx`
- `app/(fi-admin)/fi-admin/[tenantId]/layout.tsx`
- `app/(fi-admin)/fi-admin/[tenantId]/configuration/page.tsx`

See also: [14-tenant-configuration-branding.md](./14-tenant-configuration-branding.md), [15-configuration-admin-editing.md](./15-configuration-admin-editing.md).
