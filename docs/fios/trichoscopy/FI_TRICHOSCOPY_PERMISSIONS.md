# FI Trichoscopy — Permissions & Entitlements

## Capabilities

See `TrichoscopyCapability` in `trichoscopyCapabilities.ts`.

Commercial tiers map to capability packages (`capture`, `clinical`, `longitudinal`, `surgical`, `complete`). Clinical logic must never branch on plan name strings.

## Effective capabilities

```
subscribed ∩ tenant-config ∩ platform-enabled (+ temporary overrides)
```

Tenant settings cannot enable unsubscribed capabilities.

## Guards

- `requireTenantModuleCapability` — API / mutations
- `resolveTrichoscopyRouteAccess` — layouts / nav
- Historical read-only after expiry/cancellation for `trichoscopy.view` / `trichoscopy.confirmed_evidence`

## Manual overrides

`fi_tenant_module_overrides` — time-bounded, audited, cannot bypass `FI_ENABLE_HLI_TRICHOSCOPY`.
