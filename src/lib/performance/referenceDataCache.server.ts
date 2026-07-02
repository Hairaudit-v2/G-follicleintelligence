import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getCalendarTimeZone } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { loadClinicRoomsForTenant } from "@/src/lib/rooms/fiClinicRooms.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

/** Per-request deduped reference data for FI OS loaders (clinicians, rooms, catalog, config). */

const REFERENCE_DATA_REVALIDATE_SEC = 300;

export type ReceptionShellBootstrap = {
  tenantName: string;
  calendarTimezone: string;
};

async function fetchReceptionShellBootstrap(tenantId: string): Promise<ReceptionShellBootstrap> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const { data, error } = await supabaseAdmin()
    .from("fi_tenants")
    .select("id, name, fi_tenant_settings(default_timezone, metadata)")
    .eq("id", tid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Tenant not found");

  const row = data as {
    name?: string | null;
    fi_tenant_settings?:
      | { default_timezone?: string | null; metadata?: unknown }
      | { default_timezone?: string | null; metadata?: unknown }[]
      | null;
  };
  const settings = Array.isArray(row.fi_tenant_settings)
    ? row.fi_tenant_settings[0]
    : row.fi_tenant_settings;
  const calendarTimezone = getCalendarTimeZone(
    settings
      ? {
          tenant: {
            default_timezone: settings.default_timezone,
            metadata: settings.metadata as Record<string, unknown> | null,
          },
        }
      : null
  );

  return {
    tenantName: String(row.name ?? "").trim() || tid,
    calendarTimezone,
  };
}

const shellBootstrapMemory = new Map<string, { at: number; value: ReceptionShellBootstrap }>();

function isNextServerRuntime(): boolean {
  return typeof process.env.NEXT_RUNTIME === "string";
}

async function loadReceptionShellBootstrapCrossRequest(tenantId: string): Promise<ReceptionShellBootstrap> {
  const tid = tenantId.trim();
  if (isNextServerRuntime()) {
    return unstable_cache(
      () => fetchReceptionShellBootstrap(tid),
      ["fi-reception-shell-bootstrap", tid],
      { revalidate: REFERENCE_DATA_REVALIDATE_SEC, tags: [`fi-tenant-${tid}`, "fi-reference-data"] }
    )();
  }
  const hit = shellBootstrapMemory.get(tid);
  if (hit && Date.now() - hit.at < REFERENCE_DATA_REVALIDATE_SEC * 1000) return hit.value;
  const value = await fetchReceptionShellBootstrap(tid);
  shellBootstrapMemory.set(tid, { at: Date.now(), value });
  return value;
}

/** Per-request dedup + cross-request cache for reception shell bootstrap (name + timezone in one query). */
export const loadReceptionShellBootstrapCached = cache(loadReceptionShellBootstrapCrossRequest);

export const loadTenantCalendarSettingsCached = cache((tenantId: string, clinicId?: string | null) =>
  loadTenantOperationalCalendarSettings(tenantId.trim(), clinicId?.trim() || null)
);

export const loadClinicalStaffPickerCached = cache((tenantId: string) =>
  loadClinicalStaffPickerOptions(tenantId.trim())
);

export const loadCrmShellUsersCached = cache((tenantId: string) =>
  loadCrmShellUserPickerOptions(tenantId.trim())
);

export const loadFiServicesCatalogCached = cache((tenantId: string) =>
  loadFiServicesForTenant(tenantId.trim())
);

export const loadTenantClinicsCached = cache(async (tenantId: string) => {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const { data, error } = await supabaseAdmin()
    .from("fi_clinics")
    .select("id, display_name, tenant_id")
    .eq("tenant_id", tid)
    .order("display_name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const loadTenantRoomsCached = cache((tenantId: string) =>
  loadClinicRoomsForTenant(tenantId.trim())
);

/** Service catalog + appointment-type labels (safe to cache per request). */
export const loadAppointmentTypesCatalogCached = loadFiServicesCatalogCached;

export const loadTenantConfigCached = cache(async (tenantId: string) => {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const { data, error } = await supabaseAdmin()
    .from("fi_tenants")
    .select("id, name, config_json")
    .eq("id", tid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Tenant not found");
  return data as { id: string; name?: string | null; config_json?: unknown };
});

/** SA-1 module permission matrix — re-export of per-request cached role templates. */
export { loadRoleTemplateFromDb as loadRolePermissionMatrixCached } from "@/src/lib/staffAccess/staffAccess.server";

/** SA-2 field permission matrix — re-export of per-request cached role field templates. */
export {
  loadRoleFieldTemplateFromDb as loadRoleFieldPermissionMatrixCached,
} from "@/src/lib/staffAccess/staffFieldAccess.server";