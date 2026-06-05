import "server-only";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { normalizeFiOsRole } from "@/src/lib/fiOs/fiOsRoles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export type ServicesCatalogPageResult = {
  services: FiServiceRow[];
  canManageServices: boolean;
};

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
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: String((data as { id: string }).id), role: String((data as { role: string | null }).role ?? "member") };
}

export async function loadServicesCatalogPage(tenantId: string): Promise<ServicesCatalogPageResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const services = await loadFiServicesForTenant(tid);

  const authId = await resolveAuthUserId(null);
  let canManageServices = false;
  if (authId) {
    const row = await loadFiUserRow(tid, authId);
    if (row && isCrmStaffManageRole(row.role)) canManageServices = true;
    if (!canManageServices) {
      const os = await loadFiOsIdentity(authId);
      if (normalizeFiOsRole(os?.osRole) === "fi_admin") canManageServices = true;
    }
  }

  return { services, canManageServices };
}
