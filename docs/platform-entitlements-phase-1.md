# Platform Entitlements — Phase 1

Phase 1 adds a **shared entitlement engine** for paid FI OS add-on modules (starting with **HR OS**, designed for all modules). Enforcement is **server-side** via `supabaseAdmin` / service role. Clients receive only **sanitized** entitlement snapshots — never billing plan ids, prices, or subscription metadata.

## Database

Migration: `supabase/migrations/20260921120007_fi_platform_entitlements_phase1.sql`

| Table | Purpose |
|-------|---------|
| `fi_modules` | Canonical module catalog (`reception_os`, `hr_os`, …) |
| `fi_subscription_plans` | Internal plan registry (Stripe wiring comes later) |
| `fi_tenant_billing_status` | Per-tenant subscription state (`active`, `trialing`, …) |
| `fi_tenant_modules` | Per-tenant enablement + optional role overrides |
| `fi_entitlement_audit_events` | Append-only access-check audit |

`fi_tenants.verification_status` is added: `unverified` | `verified` | `enterprise_verified`.

All entitlement tables use **RLS + service_role grants** (same pattern as Nexus provisioning tables).

## Access rule

A tenant member may access a module only when **all** of the following hold:

1. Tenant exists and `verification_status` is `verified` or `enterprise_verified`
2. `fi_tenant_billing_status.subscription_status` is `active` or `trialing` (missing row ⇒ `inactive`)
3. Module exists in `fi_modules` and is enabled in `fi_tenant_modules`
4. User has a `fi_users` row for the tenant
5. User `role` is in the module allow-list (`fi_tenant_modules.allowed_roles`, else `fi_modules.default_allowed_roles`)

Optional `requiredRoles` on `requireModuleAccess` applies a tighter gate on top of the module allow-list.

## Library (`src/lib/platform/entitlements/`)

| File | Role |
|------|------|
| `entitlementTypes.ts` | Shared types + safe denial codes |
| `modules.ts` | Module registry, `evaluateModuleAccess`, `canShowModuleNav` |
| `tenantEntitlements.server.ts` | Load DB context + build client-safe snapshots |
| `requireModuleAccess.server.ts` | Server gate used by routes/actions |
| `entitlementAudit.server.ts` | Writes `fi_entitlement_audit_events` |

### Server gate

```ts
import { requireModuleAccess } from "@/src/lib/platform/entitlements/requireModuleAccess.server";

const access = await requireModuleAccess({
  tenantId,
  userId: fiUserId,
  moduleCode: "hr_os",
  requiredRoles: ["admin"], // optional
});

if (!access.ok) {
  // access.reason + access.message — safe for UI; no billing internals
}
```

### Client nav helper

Load `ClientSafeTenantEntitlements` on the server, pass to the client, then:

```ts
import { canShowModuleNav } from "@/src/lib/platform/entitlements/modules";

canShowModuleNav(entitlements, "hr_os");
```

## Provisioning checklist (manual until Stripe Phase 2)

For a tenant to use a paid module:

1. Set `fi_tenants.verification_status` to `verified` or `enterprise_verified`
2. Upsert `fi_tenant_billing_status` with `subscription_status` `active` or `trialing`
3. Insert/update `fi_tenant_modules` with `enabled = true` for the target `fi_modules` row

## Tests

- `src/lib/platform/entitlements/modules.test.ts` — pure policy cases
- `src/lib/platform/entitlements/requireModuleAccess.test.ts` — mock Supabase + audit on denial

Run: `npm run test:unit` (or `tsx --test src/lib/platform/entitlements/*.test.ts`).

## Out of scope (Phase 1)

- Stripe checkout, webhooks, or public pricing
- Route wiring for HR OS (consumers call `requireModuleAccess` in Phase 1b)
- Authenticated RLS reads on billing tables (service role only)
