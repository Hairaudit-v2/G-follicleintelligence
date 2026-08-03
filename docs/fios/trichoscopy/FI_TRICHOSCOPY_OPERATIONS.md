# FI Trichoscopy — Operations

## Enable for a tenant (manual until billing webhooks)

```ts
import { upsertTrichoscopyEntitlement, setTrichoscopyModuleConfiguration } from "@/src/lib/platform/entitlements/trichoscopyEntitlementLifecycle.server";

await upsertTrichoscopyEntitlement({
  tenantId,
  status: "active", // or "trial"
  capabilityTier: "clinical",
  source: "manual_grant",
  actorUserId,
});

await setTrichoscopyModuleConfiguration({
  tenantId,
  enabled: true,
  settings: {
    allowClinicCapture: true,
    allowPatientReports: true,
  },
  actorUserId,
});
```

Also ensure tenant verification + `fi_tenant_modules` / billing status allow `requireModuleAccess` for `hli_trichoscopy` (same pattern as HR OS via `activateTenantModule`).

## Staging round-trip checklist

1. Enable `FI_ENABLE_HLI_TRICHOSCOPY=1` and HLI credentials.
2. Grant entitlement + enable module for a staging tenant.
3. Request consultation trichoscopy from a patient workspace.
4. Confirm one HLI episode id persisted on the FiOS link.
5. Deliver a signed `trichoscopy.observation_confirmed` event with evidence pack id.
6. Confirm pack import + timeline + Action Centre closure.
7. Disable entitlement for a second tenant and verify UI nav hidden + API `404/403`.

## Staging round-trip evidence (current)

As of FI-TRICHOSCOPY-1A delivery, CI uses the stub adapter (no live HLI credentials in default env). **Verdict: AMBER** until a staging round-trip is recorded here with episode id + receipt id + pack id.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Nav hidden | Platform flag, entitlement status, module `enabled`, user role |
| 404 on routes | Concealment for not-entitled / platform-off |
| Events 401 | Webhook secret, skew, signature canonical string |
| Duplicate episodes | Idempotency key on request table |
