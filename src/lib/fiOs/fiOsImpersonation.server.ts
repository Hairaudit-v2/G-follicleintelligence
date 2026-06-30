import "server-only";

import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { loadFiOsIdentity } from "./fiOsIdentity.server";
import { isFiOsPlatformAdminRole } from "./fiOsRoles";

/** HttpOnly cookie set by POST /api/fi-os/impersonation/start (server only). */
export const FI_OS_IMPERSONATION_COOKIE = "fi_os_impersonation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/**
 * When the signed-in user is `fi_platform_admin` and a valid impersonation cookie is present,
 * returns the target auth user id. Otherwise null.
 */
export async function getFiOsImpersonationTargetAuthUserId(
  sessionAuthUserId: string | null
): Promise<string | null> {
  const sid = sessionAuthUserId?.trim() ?? "";
  if (!sid) return null;
  const os = await loadFiOsIdentity(sid);
  if (!os || !isFiOsPlatformAdminRole(os.osRole)) return null;
  try {
    const raw = cookies().get(FI_OS_IMPERSONATION_COOKIE)?.value?.trim() ?? "";
    if (!raw || !isUuid(raw)) return null;
    return raw.toLowerCase();
  } catch {
    return null;
  }
}

export async function endOpenFiOsImpersonationSessions(initiatorAuthUserId: string): Promise<void> {
  const id = initiatorAuthUserId.trim();
  if (!id) return;
  const supabase = supabaseAdmin();
  await supabase
    .from("fi_os_impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("initiator_auth_user_id", id)
    .is("ended_at", null);
}

export async function insertFiOsImpersonationSessionRow(opts: {
  initiatorAuthUserId: string;
  targetAuthUserId: string;
  tenantId?: string | null;
  clientIp: string | null;
  userAgent: string | null;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_os_impersonation_sessions").insert({
    initiator_auth_user_id: opts.initiatorAuthUserId.trim(),
    target_auth_user_id: opts.targetAuthUserId.trim(),
    tenant_id: opts.tenantId?.trim() || null,
    client_ip: opts.clientIp,
    user_agent: opts.userAgent,
  });
  if (error) throw new Error(error.message);
}
