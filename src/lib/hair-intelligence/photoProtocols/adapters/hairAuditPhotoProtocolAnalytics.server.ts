import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPhotoProtocolAnalyticsForTenant,
  type PhotoProtocolAnalyticsFilters,
  type PhotoProtocolAnalyticsForTenantResult,
} from "../photoProtocolAnalyticsLoader.server";

/**
 * HairAudit adapter: tenant analytics restricted to `source_system = hairaudit`.
 * Reuses shared Stage 8C analytics helpers via the loader + pure calculators.
 */
export async function loadHairAuditPhotoProtocolAnalyticsForTenant(
  tenantId: string,
  filters: Omit<PhotoProtocolAnalyticsFilters, "source_system"> = {},
  client?: SupabaseClient
): Promise<PhotoProtocolAnalyticsForTenantResult> {
  return loadPhotoProtocolAnalyticsForTenant(
    tenantId,
    { ...filters, source_system: "hairaudit" },
    client
  );
}
