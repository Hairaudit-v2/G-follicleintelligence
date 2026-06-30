import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPhotoProtocolAnalyticsForTenant,
  type PhotoProtocolAnalyticsFilters,
  type PhotoProtocolAnalyticsForTenantResult,
} from "../photoProtocolAnalyticsLoader.server";

/**
 * Hair Longevity adapter: tenant analytics restricted to `source_system = hair_longevity`.
 * Placeholder surface for HLI intake/progress parity without duplicating query logic.
 */
export async function loadHairLongevityPhotoProtocolAnalyticsForTenant(
  tenantId: string,
  filters: Omit<PhotoProtocolAnalyticsFilters, "source_system"> = {},
  client?: SupabaseClient
): Promise<PhotoProtocolAnalyticsForTenantResult> {
  return loadPhotoProtocolAnalyticsForTenant(
    tenantId,
    { ...filters, source_system: "hair_longevity" },
    client
  );
}
