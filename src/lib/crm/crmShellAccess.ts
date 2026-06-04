import "server-only";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "./crmGate";
import { isCrmShellNavRole } from "./crmGatePolicy";

export type CrmShellSession = {
  authUserId: string;
  fiUserId: string;
  role: string;
};

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

/**
 * Whether to show the CRM nav link for this tenant (signed-in + fi_users role).
 */
export async function getCrmShellNavAllowed(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  if (!tid) return false;
  const authId = await resolveAuthUserId(null);
  if (!authId) return false;
  const row = await loadFiUserRow(tid, authId);
  if (!row) return false;
  return isCrmShellNavRole(row.role);
}

/**
 * Enforce Stage 2E route gate: same roles as CRM shell nav. Redirects to tenant Cases if unauthorised.
 */
export async function assertCrmShellPageAccess(tenantId: string): Promise<CrmShellSession> {
  const tid = tenantId.trim();
  if (!tid) redirect("/fi-admin");

  const authId = await resolveAuthUserId(null);
  if (!authId) {
    redirect("/fi-admin");
  }

  const row = await loadFiUserRow(tid, authId);
  if (!row || !isCrmShellNavRole(row.role)) {
    redirect(`/fi-admin/${tid}/cases`);
  }

  return { authUserId: authId, fiUserId: row.id, role: row.role };
}
