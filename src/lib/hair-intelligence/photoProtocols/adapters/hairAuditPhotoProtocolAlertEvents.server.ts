import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPhotoProtocolAlertEventsForTenant,
  upsertPhotoProtocolAlertEventsForTenant,
  type PhotoProtocolAlertEventsFilters,
  type UpsertPhotoProtocolAlertEventsResult,
} from "../protocolAlertEvents.server";

/**
 * HairAudit adapter: persisted alerts scoped to `source_system = hairaudit`.
 * Alert rules remain in `protocolAlerts.ts` — this module is routing + persistence only.
 */
export async function upsertHairAuditPhotoProtocolAlertEventsForTenant(
  tenantId: string,
  filters: Omit<PhotoProtocolAlertEventsFilters, "source_system"> = {},
  client?: SupabaseClient
): Promise<UpsertPhotoProtocolAlertEventsResult> {
  return upsertPhotoProtocolAlertEventsForTenant(
    tenantId,
    { ...filters, source_system: "hairaudit" },
    client
  );
}

export async function loadHairAuditPhotoProtocolAlertEventsForTenant(
  tenantId: string,
  filters: Omit<PhotoProtocolAlertEventsFilters, "source_system"> = {},
  client?: SupabaseClient
) {
  return loadPhotoProtocolAlertEventsForTenant(
    tenantId,
    { ...filters, source_system: "hairaudit" },
    client
  );
}
