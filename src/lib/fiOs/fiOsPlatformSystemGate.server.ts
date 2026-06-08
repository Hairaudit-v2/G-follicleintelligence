import "server-only";

import { redirect } from "next/navigation";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

import { loadFiOsIdentity } from "./fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "./fiOsRoles";

function loginUrl(nextPath: string): string {
  const q = new URLSearchParams();
  q.set("next", nextPath);
  return `/follicle-intelligence/login?${q.toString()}`;
}

/** FI System Administration (`/fi-admin/system/*`): `fi_platform_admin` only (all environments). */
export async function assertFiPlatformAdminSystemAccess(): Promise<void> {
  const authId = await resolveAuthUserId(null);
  if (!authId) {
    redirect(loginUrl("/fi-admin/system"));
  }
  const os = await loadFiOsIdentity(authId);
  if (!os || !isFiOsPlatformAdminRole(os.osRole)) {
    redirect("/fi-admin?notice=no_platform_admin");
  }
}
