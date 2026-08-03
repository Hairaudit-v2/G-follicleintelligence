/**
 * Pure helpers for trichoscopy entitlement cache keys and invalidation tags.
 */

import { HLI_TRICHOSCOPY_MODULE_KEY } from "./trichoscopyCapabilities";

export function trichoscopyAccessCacheKey(tenantId: string, capability?: string): string {
  const tid = tenantId.trim();
  const cap = String(capability ?? "*").trim() || "*";
  return `trichoscopy-access:${tid}:${cap}`;
}

export function trichoscopyEntitlementCacheTag(tenantId: string): string {
  return `fi-module-entitlement:${tenantId.trim()}:${HLI_TRICHOSCOPY_MODULE_KEY}`;
}

export function trichoscopyConfigCacheTag(tenantId: string): string {
  return `fi-module-config:${tenantId.trim()}:${HLI_TRICHOSCOPY_MODULE_KEY}`;
}
