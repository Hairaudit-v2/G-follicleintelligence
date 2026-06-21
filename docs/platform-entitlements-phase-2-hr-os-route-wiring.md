# Platform Entitlements — Phase 2 (HR OS route wiring)

Phase 2 wires the Phase 1 entitlement engine into **HR OS** as the first paid FI OS add-on module. All enforcement remains **server-side**; clients never receive billing plan ids, prices, or subscription metadata.

## Route surface

| Path | Purpose |
|------|---------|
| `/fi-admin/[tenantId]/hr-os` | Protected HR OS module home (placeholder command centre) |
| `/fi-admin/[tenantId]/hr-os/*` | Future HR OS sub-routes (same layout gate) |

Legacy HR tooling under `/fi-admin/[tenantId]/hr/*` remains available until a later migration consolidates under `hr-os`.

## Access rule (HR OS routes)

A tenant member may enter HR OS routes only when **all** of the following hold:

1. Signed-in session with a `fi_users` row for the tenant (or FI platform admin preview — see below)
2. Tenant `verification_status` is `verified` or `enterprise_verified`
3. `fi_tenant_billing_status.subscription_status` is `active` or `trialing`
4. `hr_os` is enabled in `fi_tenant_modules`
5. User `role` is in the module allow-list **and** in the tighter HR OS route roles: `owner`, `admin`, or `hr_manager`

Platform operators (`fi_platform_admin` / full session bypass) may enter HR OS in **preview mode** without satisfying tenant entitlements. Nav remains visible for platform admins so they can support provisioning.

## Library additions

| File | Role |
|------|------|
| `hrOsRouteGate.server.ts` | `resolveHrOsRouteAccess`, `loadHrOsNavVisibleForViewer`, `evaluateHrOsModuleEntitlement` |
| `activateTenantModule.server.ts` | Manual enable/disable until Stripe (`activateTenantModule`, `deactivateTenantModule`) |
| `FiModuleAccessDenied.tsx` | Safe denied-state UI (no billing internals) |

### Route gate (layout)

```ts
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

const access = await resolveHrOsRouteAccess(tenantId);
if (!access.ok) {
  // Render FiModuleAccessDenied with access.access.reason
}
```

The HR OS layout at `app/(fi-admin)/fi-admin/[tenantId]/hr-os/layout.tsx` applies this gate to all nested routes.

### Navigation visibility

The tenant layout loads `loadHrOsNavVisibleForViewer(tenantId)`, which builds `ClientSafeTenantEntitlements` for `hr_os` and applies `canShowModuleNav`. HR OS is **hidden** from the primary sidebar when the viewer lacks entitlement.

### Manual activation (admin-only)

Until Stripe checkout/webhooks ship, enable HR OS for a verified tenant:

```ts
import { activateTenantModule } from "@/src/lib/platform/entitlements/activateTenantModule.server";

await activateTenantModule({
  tenantId,
  moduleCode: "hr_os",
  subscriptionStatus: "active", // or "trialing"
  verificationStatus: "verified", // or "enterprise_verified"
});
```

This upserts verification, billing status, and `fi_tenant_modules.enabled = true`.

Disable:

```ts
import { deactivateTenantModule } from "@/src/lib/platform/entitlements/activateTenantModule.server";

await deactivateTenantModule({ tenantId, moduleCode: "hr_os" });
```

Call from server actions or scripts with `FI_ADMIN_API_KEY` / platform-admin guards — do not expose publicly.

## Denied-state UI

`FiModuleAccessDenied` maps safe denial codes to user-facing copy:

| Reason | User-facing title |
|--------|-------------------|
| `tenant_unverified` | Clinic not activated |
| `module_disabled` | Module not enabled |
| `billing_inactive` | Subscription inactive |
| `role_not_allowed` | Insufficient role |
| *(other)* | Access unavailable (generic fallback) |

No subscription plan ids, Stripe ids, or raw DB errors are shown.

## Audit events

Written to `fi_entitlement_audit_events` with module code `hr_os`:

| `source` | When |
|----------|------|
| `hr_os_route_access` | HR OS layout gate allowed or denied |
| `hr_os_module_manual_enable` | `activateTenantModule` for `hr_os` |
| `hr_os_module_manual_disable` | `deactivateTenantModule` for `hr_os` |

Phase 1 `require_module_access` audits still apply when calling `requireModuleAccess` directly with default audit enabled.

## Tests

`src/lib/platform/entitlements/hrOsRouteWiring.test.ts` covers:

- Entitled vs denied access matrix (verification, billing, module, role)
- Trialing billing allowed
- Nav show/hide via `canShowModuleNav` and `loadClientSafeTenantEntitlements`
- Manual activation / deactivation
- Route denial audit (`hr_os_route_access`)

Run: `npm run test:unit` or `tsx --test src/lib/platform/entitlements/hrOsRouteWiring.test.ts`.

## Out of scope (Phase 2)

- Stripe checkout, webhooks, or public pricing
- Migrating legacy `/hr/*` routes under the `hr-os` gate
- Authenticated RLS reads on billing tables (service role only)

## Related

- Phase 1 engine: `docs/platform-entitlements-phase-1.md`
- Migration: `supabase/migrations/20260921120007_fi_platform_entitlements_phase1.sql`
