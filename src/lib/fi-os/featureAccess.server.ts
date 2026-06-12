import "server-only";

import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantStaffManageAllowed,
  CrmAccessError,
  isFiOsPlatformAdminFullSessionBypass,
  resolveAuthUserId,
} from "@/src/lib/crm/crmGate";
import {
  applyPartialFeatureOverrides,
  buildDefaultFeatureAccessAllEnabled,
  isFiFeatureKey,
  type FiFeatureKey,
} from "@/src/config/fiFeatureAccessRegistry";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsElevatedOsOperatorRole, isFiOsPlatformAdminRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";

export type FiOsFeatureAccessMap = ReadonlyMap<FiFeatureKey, boolean>;

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

/**
 * Schedulable staff row linked to the tenant member, if any.
 */
export async function tryResolveViewerStaffIdForTenant(tenantId: string, fiUserId: string): Promise<string | null> {
  const tid = tenantId.trim();
  const uid = fiUserId.trim();
  if (!tid || !uid) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_staff").select("id").eq("tenant_id", tid).eq("fi_user_id", uid).maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

/**
 * Loads explicit per-feature toggles from `fi_staff_feature_access` for one staff member.
 * Unknown `feature_key` values from the database are ignored.
 */
export async function loadStaffFeatureAccessOverrides(
  tenantId: string,
  staffId: string | null
): Promise<Partial<Record<FiFeatureKey, boolean>>> {
  const tid = tenantId.trim();
  const sid = staffId?.trim() ?? "";
  if (!tid || !sid) return {};
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_feature_access")
    .select("feature_key, enabled")
    .eq("tenant_id", tid)
    .eq("staff_id", sid);
  if (error || !data) return {};
  const out: Partial<Record<FiFeatureKey, boolean>> = {};
  for (const raw of data) {
    const row = raw as { feature_key: string; enabled: boolean };
    const k = String(row.feature_key ?? "");
    if (!isFiFeatureKey(k)) continue;
    out[k] = Boolean(row.enabled);
  }
  return out;
}

export function mergeEffectiveFeatureAccessMap(overrides: Partial<Record<FiFeatureKey, boolean>>): Map<FiFeatureKey, boolean> {
  return applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), overrides);
}

/**
 * Returns `null` when Stage-2 filtering should be skipped (full legacy UI).
 * Platform operators always receive `null` so every module stays discoverable.
 */
async function loadFiOsFeatureAccessMapOrNullForViewerImpl(tenantId: string): Promise<FiOsFeatureAccessMap | null> {
  const tid = tenantId.trim();
  if (!tid) return null;

  try {
    const authId = await resolveAuthUserId(null);
    if (!authId) return null;

    const os = await loadFiOsIdentity(authId);
    if (os && isFiOsPlatformAdminRole(os.osRole)) {
      return null;
    }

    if (await isFiOsPlatformAdminFullSessionBypass(authId)) {
      return null;
    }

    const fiUser = await loadFiUserRow(tid, authId);
    const staffId = fiUser ? await tryResolveViewerStaffIdForTenant(tid, fiUser.id) : null;
    const overrides = staffId ? await loadStaffFeatureAccessOverrides(tid, staffId) : {};
    return mergeEffectiveFeatureAccessMap(overrides);
  } catch {
    return null;
  }
}

/** Deduped per request (layout + home page). */
export const loadFiOsFeatureAccessMapOrNullForViewer = cache(loadFiOsFeatureAccessMapOrNullForViewerImpl);

export async function resolveCanManageStaffFeatureAccessSettings(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  const authId = await resolveAuthUserId(null);
  if (!tid || !authId) return false;
  if (await isFiOsPlatformAdminFullSessionBypass(authId)) return true;
  const row = await loadFiUserRow(tid, authId);
  if (row && isCrmStaffManageRole(row.role)) return true;
  const os = await loadFiOsIdentity(authId);
  if (isFiOsElevatedOsOperatorRole(os?.osRole)) return true;
  const admin = await loadActiveTenantAdminProfileForSession(tid, authId);
  return Boolean(admin);
}

export async function assertCanManageStaffFeatureAccessSettings(tenantId: string): Promise<void> {
  const ok = await resolveCanManageStaffFeatureAccessSettings(tenantId);
  if (!ok) {
    throw new CrmAccessError(403, "Admin or tenant administrator access is required to edit staff feature visibility.");
  }
}

/** Staff directory admins (`assertCrmTenantStaffManageAllowed`) **or** active tenant-backend admins. */
export async function assertStaffFeatureAccessMutationAllowed(opts: {
  tenantId: string;
  adminKey?: string | null;
}): Promise<void> {
  try {
    await assertCrmTenantStaffManageAllowed({
      tenantId: opts.tenantId,
      adminKey: opts.adminKey,
      request: undefined,
    });
    return;
  } catch (e) {
    if (e instanceof CrmAccessError && e.status === 401) throw e;
  }
  await assertCanManageStaffFeatureAccessSettings(opts.tenantId);
}

/**
 * Applies a sparse patch. Omitted keys are unchanged in the database.
 * `true` deletes an override row (inherit default-on). `false` upserts `enabled = false`.
 */
export async function persistStaffFeatureAccessPatch(opts: {
  tenantId: string;
  staffId: string;
  patch: Partial<Record<FiFeatureKey, boolean>>;
  editorAuthUserId: string | null;
}): Promise<void> {
  const tid = opts.tenantId.trim();
  const sid = opts.staffId.trim();
  if (!tid || !sid) throw new Error("tenantId and staffId are required.");
  const supabase = supabaseAdmin();
  const editorFiUserId = opts.editorAuthUserId?.trim()
    ? (await loadFiUserRow(tid, opts.editorAuthUserId.trim()))?.id ?? null
    : null;

  for (const [raw, enabled] of Object.entries(opts.patch)) {
    if (!isFiFeatureKey(raw)) continue;
    if (enabled) {
      const { error } = await supabase
        .from("fi_staff_feature_access")
        .delete()
        .eq("tenant_id", tid)
        .eq("staff_id", sid)
        .eq("feature_key", raw);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("fi_staff_feature_access").upsert(
        {
          tenant_id: tid,
          staff_id: sid,
          feature_key: raw,
          enabled: false,
          updated_by_user_id: editorFiUserId,
          created_by_user_id: editorFiUserId,
        },
        { onConflict: "tenant_id,staff_id,feature_key" }
      );
      if (error) throw new Error(error.message);
    }
  }
}
