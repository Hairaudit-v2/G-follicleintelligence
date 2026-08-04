# FI-TRICHOSCOPY-1A — Integration Foundation

## Ownership boundaries

- **FiOS** owns patient journey, clinic workflow, Action Centre, timeline, requests, and imported evidence-pack display.
- **HLI** owns capture, measurement, interpretation, confirmation, and evidence-pack generation.

Do not rebuild follicle counting, calibration, density, donor/recipient synthesis, or treatment-response logic inside FiOS.

## Module key

`hli_trichoscopy`

## Control layers

Access requires all applicable layers:

1. `FI_ENABLE_HLI_TRICHOSCOPY=1` (platform emergency / rollout flag)
2. Tenant entitlement projection (`fi_tenant_module_entitlements`)
3. Tenant module configuration enabled (`fi_tenant_module_configurations`)
4. Capability included (tier ∩ config ∩ platform)
5. User role permitted (`requireModuleAccess` / module allow-list)
6. Patient/case belongs to tenant

Canonical guard: `src/lib/entitlements/requireTenantModuleCapability.ts`

Canonical resolver: `resolveFiosTrichoscopyAccess`

## Adapter

`src/lib/integrations/hliTrichoscopy/`

All HLI communication must go through this package.

## Migrations

- `20261108120001_fi_hli_trichoscopy_entitlements_1a.sql`
- `20261108120002_fi_hli_trichoscopy_integration_1a.sql`

## Routes

| Path | Purpose |
|------|---------|
| `/fi-admin/[tenantId]/trichoscopy` | Module home (gated) |
| `/fi-admin/[tenantId]/patients/[patientId]/trichoscopy` | Patient workspace |
| `/fi-admin/[tenantId]/settings/modules/trichoscopy` | Admin module settings |
| `/api/integrations/hli/trichoscopy/events` | Signed inbound events |
| `/api/fi-admin/[tenantId]/trichoscopy/request` | Create request |

## Feature flags / env

```env
FI_ENABLE_HLI_TRICHOSCOPY=1
HLI_TRICHOSCOPY_API_BASE_URL=
HLI_TRICHOSCOPY_SERVICE_KEY=
HLI_TRICHOSCOPY_SIGNING_SECRET=
HLI_TRICHOSCOPY_WEBHOOK_SECRET=
HLI_TRICHOSCOPY_REQUEST_TIMEOUT_MS=10000
HLI_TRICHOSCOPY_MAX_RETRIES=2
```

When API credentials are absent, the adapter uses an in-process stub (CI / local).

## Rollback

1. Set `FI_ENABLE_HLI_TRICHOSCOPY=0` — blocks new usage and routes.
2. Do not drop clinical tables; historical packs remain.
3. Optionally `deactivate` via `setTrichoscopyModuleConfiguration({ enabled: false })`.

## Verdict guidance

- **GREEN**: staging FiOS↔HLI round-trip proven + entitlement denial for unentitled tenants on UI and API. Evidence committed under [`evidence/`](./evidence/FI-TRICHOSCOPY-1A.1-LIVE-STAGING-CERTIFICATION.md).
- **AMBER**: foundations + stub tests pass; staging round-trip pending (**current** as of 1A.1 harness scaffold).
- **RED**: any RED condition in the phase brief (cross-tenant leak, unsigned events accepted, packs overwritten, etc.).

Phase follow-ons: **1A.1** live staging cert → **1A.2** browser/failure E2E → **[1B consultation](./FI_TRICHOSCOPY_1B_CONSULTATION_INTEGRATION.md)** → **1C** longitudinal/treatment → **1D** commercial automation.
