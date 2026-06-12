import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantConfig, type TenantConfig } from "@/lib/fi/tenantConfig";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { parseFeatureAccessJsonObject } from "@/src/lib/fi-os/organisationalProfile.merge";
import type { FiTenantOperatingModeRow } from "@/src/lib/fi-os/organisationalProfile.schema";

function mapOperatingMode(row: Record<string, unknown>): FiTenantOperatingModeRow {
  return {
    id: String(row.id),
    tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
    mode_key: String(row.mode_key ?? ""),
    label: String(row.label ?? ""),
    description: row.description != null ? String(row.description) : null,
    default_features: row.default_features,
    default_workspace_profiles: row.default_workspace_profiles,
    is_system: Boolean(row.is_system),
    is_active: Boolean(row.is_active),
  };
}

export async function loadTenantOperatingModeRowByKey(
  tenantId: string,
  modeKey: string
): Promise<FiTenantOperatingModeRow | null> {
  const tid = tenantId.trim();
  const mk = modeKey.trim();
  if (!mk) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenant_operating_modes")
    .select("*")
    .eq("mode_key", mk)
    .or(`tenant_id.is.null,tenant_id.eq.${tid}`)
    .eq("is_active", true)
    .limit(10);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const tenantScoped = rows.find((r) => r.tenant_id != null && String(r.tenant_id) === tid);
  if (tenantScoped) return mapOperatingMode(tenantScoped);
  const global = rows.find((r) => r.tenant_id == null);
  return global ? mapOperatingMode(global) : null;
}

export async function resolveTenantOperatingModeFeatureDefaults(tenantId: string): Promise<Partial<Record<FiFeatureKey, boolean>>> {
  const tid = tenantId.trim();
  if (!tid) return {};
  const supabase = supabaseAdmin();
  const raw = await getTenantConfig(supabase, tid);
  const modeKey = (raw as TenantConfig | null)?.fi_os_operating_mode_key;
  if (typeof modeKey !== "string" || !modeKey.trim()) return {};
  const mode = await loadTenantOperatingModeRowByKey(tid, modeKey);
  if (!mode) return {};
  return parseFeatureAccessJsonObject(mode.default_features);
}
