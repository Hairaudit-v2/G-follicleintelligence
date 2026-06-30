import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import {
  normalizeFiAdminTenantPathSuffix,
  resolveRequiredFiFeatureForTenantSuffix,
} from "@/src/config/fiRouteFeatureMap";

export type FiFeatureRouteDecision =
  | { kind: "allow" }
  | { kind: "deny"; feature: FiFeatureKey; reason: "feature_disabled" };

export function resolveFiFeatureRouteDecision(opts: {
  pathname: string;
  tenantBase: string;
  featureAccessMap: ReadonlyMap<FiFeatureKey, boolean> | null;
  isActiveTenantBackendAdmin: boolean;
}): FiFeatureRouteDecision {
  const suffix = normalizeFiAdminTenantPathSuffix(opts.pathname, opts.tenantBase);
  if (suffix === "module-unavailable" || suffix.startsWith("module-unavailable/")) {
    return { kind: "allow" };
  }
  if (suffix === "staff-pin-login" || suffix.startsWith("staff-pin-login/")) {
    return { kind: "allow" };
  }

  const required = resolveRequiredFiFeatureForTenantSuffix(suffix);
  if (!required) return { kind: "allow" };

  if (opts.featureAccessMap === null) {
    return { kind: "allow" };
  }

  if (required === "settings" && opts.isActiveTenantBackendAdmin) {
    return { kind: "allow" };
  }

  if (opts.featureAccessMap.get(required) === false) {
    return { kind: "deny", feature: required, reason: "feature_disabled" };
  }

  return { kind: "allow" };
}

export function buildFiOsModuleUnavailableHref(tenantBase: string, feature: FiFeatureKey): string {
  const b = tenantBase.replace(/\/+$/, "") || "";
  const q = new URLSearchParams();
  q.set("featureDenied", feature);
  return `${b}/module-unavailable?${q.toString()}`;
}
