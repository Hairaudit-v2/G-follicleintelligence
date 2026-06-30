import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { isFiOsRoleString, normalizeFiOsRole, type FiOsRole } from "./fiOsRoles";

export type FiOsIdentityRow = { authUserId: string; osRole: FiOsRole };

export async function loadFiOsIdentity(authUserId: string): Promise<FiOsIdentityRow | null> {
  const id = authUserId.trim();
  if (!id) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_os_identities")
    .select("os_role")
    .eq("auth_user_id", id)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { os_role: string | null }).os_role;
  const norm = normalizeFiOsRole(raw);
  if (!isFiOsRoleString(norm)) return null;
  return { authUserId: id, osRole: norm };
}

export async function hasAnyFiUsersMembership(authUserId: string): Promise<boolean> {
  const id = authUserId.trim();
  if (!id) return false;
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_users")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", id);
  if (error) return false;
  return (count ?? 0) > 0;
}

/** May use FI Admin / OS surfaces: platform row and/or tenant membership. */
export async function isFiPortalStaff(authUserId: string): Promise<boolean> {
  const os = await loadFiOsIdentity(authUserId);
  if (os) return true;
  return hasAnyFiUsersMembership(authUserId);
}

export async function loadFirstTenantIdForAuthUser(authUserId: string): Promise<string | null> {
  const id = authUserId.trim();
  if (!id) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("tenant_id")
    .eq("auth_user_id", id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const tid = (data as { tenant_id: string | null }).tenant_id;
  return tid ? String(tid) : null;
}
