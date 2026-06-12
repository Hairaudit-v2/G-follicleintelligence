import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isInsecureFiApiBypassAllowed } from "@/src/lib/fiAdmin/insecureFiApiBypass";
import { isFiOsCrossTenantDirectoryRole } from "@/src/lib/fiOs/fiOsRoles";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";

async function loadFiUserRow(tenantId: string, authUserId: string): Promise<{ id: string; role: string } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

async function assertTenantRowExists(tenantId: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId.trim()).maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export type FiTenantPortalApiAccess = { ok: true } | { ok: false; status: number; message: string };

/**
 * Route-handler variant of `assertFiTenantPortalAccess` (no redirects).
 * **Insecure bypass:** only when **`FI_ALLOW_INSECURE_API`** is `true` / `1` / `yes` and **`NODE_ENV` is not `production`**.
 * Public preview/staging with `NODE_ENV=production` therefore always requires a session + tenant gate.
 */
export async function checkFiTenantPortalApiAccess(request: Request, tenantId: string): Promise<FiTenantPortalApiAccess> {
  const tid = tenantId.trim();
  if (!tid) return { ok: false, status: 400, message: "Missing tenant." };

  if (isInsecureFiApiBypassAllowed()) {
    return { ok: true };
  }

  const authId = await resolveAuthUserId(request);
  if (!authId) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const exists = await assertTenantRowExists(tid);
  if (!exists) {
    return { ok: false, status: 404, message: "Tenant not found." };
  }

  const os = await loadFiOsIdentity(authId);
  if (os && isFiOsCrossTenantDirectoryRole(os.osRole)) {
    return { ok: true };
  }

  const row = await loadFiUserRow(tid, authId);
  if (!row) {
    return { ok: false, status: 403, message: "No access to this tenant workspace." };
  }

  return { ok: true };
}
