import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiOsRole } from "./fiOsRoles";
import { loadFiOsIdentity } from "./fiOsIdentity.server";
import { loadMembershipTenantIdsForAuthUser } from "@/src/lib/workforce/staffTenantLinkRepair.server";
import {
  readMetadataTenantId,
  resolvePostLoginDestination,
} from "@/src/lib/workforce/staffTenantLinkRepairCore";

async function loadAuthMetadataTenantId(authUserId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.auth.admin.getUserById(authUserId.trim());
  if (error || !data.user) return null;
  return readMetadataTenantId((data.user.user_metadata ?? {}) as Record<string, unknown>);
}

/**
 * Server-only post-login redirect for Follicle Intelligence OS.
 * Uses `fi_os_identities` and `fi_users` only via service role — never trust client hints.
 * When the login action has no valid `next` path, tenant members default to `/fi-admin/[tenantId]/cases`
 * (see `docs/fi-os-access-production.md`).
 */
export async function resolveFiOsPostLoginRedirect(
  authUserId: string,
  explicitNext?: string | null
): Promise<string> {
  const os = await loadFiOsIdentity(authUserId);
  const r = os ? normalizeFiOsRole(os.osRole) : "";

  if (r === "fi_auditor") {
    return "/hair-audit/admin";
  }

  if (r === "fi_admin" || r === "fi_platform_admin") {
    return "/fi-admin";
  }

  const [membershipTenantIds, metadataTenantId] = await Promise.all([
    loadMembershipTenantIdsForAuthUser(authUserId),
    loadAuthMetadataTenantId(authUserId),
  ]);

  if (r === "fi_clinic_admin" || r === "fi_doctor" || r === "fi_nurse" || r === "fi_consultant") {
    return resolvePostLoginDestination({
      explicitNext: explicitNext ?? null,
      membershipTenantIds,
      metadataTenantId,
    });
  }

  return resolvePostLoginDestination({
    explicitNext: explicitNext ?? null,
    membershipTenantIds,
    metadataTenantId,
  });
}
