import "server-only";

import { redirect } from "next/navigation";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

import { loadFirstTenantIdForAuthUser } from "./fiOsIdentity.server";

function fiOsLoginUrl(nextPath: string): string {
  const q = new URLSearchParams();
  q.set("next", nextPath);
  return `/follicle-intelligence/login?${q.toString()}`;
}

export type FiOsEntryAliasPath = "/fi_clinic_admin" | "/crm_operator";

/**
 * Redirect legacy role-alias entry URLs to `/fi-admin/[tenantId]/cases` (or `/fi-admin` when no membership).
 * Production requires a Supabase session; unauthenticated users are sent to FI OS login with `next` preserved.
 */
export async function redirectFiOsRoleAliasToFiAdmin(entryPath: FiOsEntryAliasPath): Promise<never> {
  if (process.env.NODE_ENV === "production") {
    const authId = await resolveAuthUserId(null);
    if (!authId) redirect(fiOsLoginUrl(entryPath));
    const tenantId = await loadFirstTenantIdForAuthUser(authId);
    if (tenantId) redirect(`/fi-admin/${tenantId}/cases`);
    redirect("/fi-admin");
  }

  const authId = await resolveAuthUserId(null);
  if (authId) {
    const tenantId = await loadFirstTenantIdForAuthUser(authId);
    if (tenantId) redirect(`/fi-admin/${tenantId}/cases`);
  }
  redirect("/fi-admin");
}
