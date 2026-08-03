/**
 * Convenience: activate platform module row + trichoscopy entitlement projection.
 * Does not auto-enable clinical workflows — call setTrichoscopyModuleConfiguration separately.
 */
import "server-only";

import { activateTenantModule } from "@/src/lib/platform/entitlements/activateTenantModule.server";
import { HLI_TRICHOSCOPY_MODULE_CODE } from "@/src/lib/platform/entitlements/modules";
import {
  upsertTrichoscopyEntitlement,
  type UpsertTrichoscopyEntitlementInput,
} from "@/src/lib/platform/entitlements/trichoscopyEntitlementLifecycle.server";
import { invalidateTrichoscopyAccessCache } from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";

export async function grantTrichoscopySubscription(opts: {
  tenantId: string;
  capabilityTier: UpsertTrichoscopyEntitlementInput["capabilityTier"];
  status?: UpsertTrichoscopyEntitlementInput["status"];
  source?: UpsertTrichoscopyEntitlementInput["source"];
  actorUserId?: string | null;
  trialEndsAt?: string | null;
  expiresAt?: string | null;
  gracePeriodEndsAt?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const activated = await activateTenantModule({
    tenantId: opts.tenantId,
    moduleCode: HLI_TRICHOSCOPY_MODULE_CODE,
    subscriptionStatus: opts.status === "trial" ? "trialing" : "active",
    verificationStatus: "verified",
  });
  if (!activated.ok) return activated;

  const entitled = await upsertTrichoscopyEntitlement({
    tenantId: opts.tenantId,
    status: opts.status ?? "active",
    capabilityTier: opts.capabilityTier,
    source: opts.source ?? "manual_grant",
    actorUserId: opts.actorUserId,
    trialEndsAt: opts.trialEndsAt,
    expiresAt: opts.expiresAt,
    gracePeriodEndsAt: opts.gracePeriodEndsAt,
  });
  invalidateTrichoscopyAccessCache(opts.tenantId);
  return entitled;
}
