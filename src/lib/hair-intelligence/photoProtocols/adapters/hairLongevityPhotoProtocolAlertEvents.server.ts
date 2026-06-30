import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadPhotoProtocolAlertEventsForTenant,
  upsertPhotoProtocolAlertEventsForTenant,
  type PhotoProtocolAlertEventsFilters,
  type UpsertPhotoProtocolAlertEventsResult,
} from "../protocolAlertEvents.server";

/**
 * Hair Longevity adapter: persisted alerts scoped to `source_system = hair_longevity`.
 * Shared alert rules live in `protocolAlerts.ts` — no duplicate rule engines here.
 */
export async function upsertHairLongevityPhotoProtocolAlertEventsForTenant(
  tenantId: string,
  filters: Omit<PhotoProtocolAlertEventsFilters, "source_system"> = {},
  client?: SupabaseClient
): Promise<UpsertPhotoProtocolAlertEventsResult> {
  return upsertPhotoProtocolAlertEventsForTenant(
    tenantId,
    { ...filters, source_system: "hair_longevity" },
    client
  );
}

export async function loadHairLongevityPhotoProtocolAlertEventsForTenant(
  tenantId: string,
  filters: Omit<PhotoProtocolAlertEventsFilters, "source_system"> = {},
  client?: SupabaseClient
) {
  return loadPhotoProtocolAlertEventsForTenant(
    tenantId,
    { ...filters, source_system: "hair_longevity" },
    client
  );
}
