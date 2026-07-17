# FI-UX-STRUCTURE-2C.2 — HubSpot canonical navigation parity

## Executive verdict

**GREEN** for navigation parity. Every authorised HubSpot role reaches its allowed surfaces through
the canonical Integrations → HubSpot workspace. The temporary Settings dropdown peer
**HubSpot import** is removed after exact role/permission reachability is demonstrated.

Base commit: `e287e6e8` (FI-UX-STRUCTURE-2C.1B) / `main` merge `2968dcfe`.

## Authorised surface matrix

| Surface | Configuration-hub | CRM-read only |
| ------- | ----------------- | ------------- |
| Overview | `/settings/integrations/hubspot?tab=overview` | Not authorised |
| Connection and sync | `backup-sync`, `configuration`, `activity-webhooks` | Not authorised |
| Migration/import review | `import-review` (+ config tabs `lead-pilot`, `contact-migration`, `quarantine-review`) | `import-review` only |
| Identity resolution | `owner-resolution`, `patient-review`, `quarantine-review` | Not authorised |
| Health and history | `backup-sync`, `activity-webhooks`, `audit-history` | Not authorised |

Capability gates on the HubSpot page are unchanged: CRM tenant read for entry; Configuration hub
for every tab except `import-review`.

## Exact changes

1. **Canonical surface contract** in `hubspotWorkspaceRoutes.ts` — five Integrations-owned
   families with entry tabs and session filters.
2. **Session-aware landing** — missing/invalid `tab` resolves to Overview for Configuration-hub
   sessions and Import Review for CRM-read sessions (bare Manage URL no longer 404s CRM-read).
3. **Integrations hub** — HubSpot card lists the five surface deep links plus Manage.
4. **Settings strip** — Configuration-hub sessions keep Integrations → hub only (no peer
   `HubSpot import`). CRM-read sessions without Configuration keep a single Integrations entry
   into `?tab=import-review`.

## Parity proof (why the temporary peer may be removed)

| Role | Path to authorised surfaces without `HubSpot import` peer |
| ---- | --------------------------------------------------------- |
| Configuration-hub | Settings → Integrations → surface links / Manage → in-workspace tabs |
| CRM-read only | Settings → Integrations → canonical HubSpot workspace (`import-review`) |

Both paths target `/settings/integrations/hubspot` — the same KEEP workspace from 2B.

## Preserved behaviour

- No HubSpot page deletion.
- No mutation, provider, or loader permission expansion.
- Legacy redirects (`/settings/imports/hubspot`, `/onboarding-os/import-review`) unchanged.
- HOLD routes untouched.
- CRM-read remains Import Review only.

## Intentionally out of scope

- Expanding CRM-read to Overview / Connection / Identity / Health
- HubSpot mutation permission redesign
- Team Access, Academy, Admin Users, Deployment

## Rollback

Revert the isolated 2C.2 commit. Reintroducing the Integrations dropdown peer is sufficient for
nav rollback; session-default tab resolution can remain.

## Recommended sequence after 2C.2

1. 2C.3 — Academy dead-link resolution
2. 2C.4 — Team Access parity
3. 2C.5 — Admin Users identity boundary
4. 2C.6 — Tenant Deployment foundation
