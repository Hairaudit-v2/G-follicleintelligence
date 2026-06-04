import "server-only";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";

import { isFiOsCrossTenantDirectoryRole } from "./fiOsRoles";
import { isFiPortalStaff, loadFiOsIdentity } from "./fiOsIdentity.server";

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

function loginUrl(nextPath: string): string {
  const q = new URLSearchParams();
  q.set("next", nextPath);
  return `/follicle-intelligence/login?${q.toString()}`;
}

/**
 * FI Admin shell: in production, require Supabase session + FI staff (OS identity or fi_users).
 * Non-production keeps legacy open access for local workflows.
 */
export async function assertFiAdminShellAccess(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const authId = await resolveAuthUserId(null);
  if (!authId) {
    redirect(loginUrl("/fi-admin"));
  }

  const ok = await isFiPortalStaff(authId);
  if (!ok) {
    redirect("/follicle-intelligence/login?notice=no_fi_access");
  }
}

/**
 * Tenant-scoped FI routes: production requires session; tenant must exist and user must be
 * cross-tenant OS staff or a member of this tenant in `fi_users`.
 */
export async function assertFiTenantPortalAccess(tenantId: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const tid = tenantId.trim();
  if (!tid) redirect(loginUrl("/fi-admin"));

  const authId = await resolveAuthUserId(null);
  if (!authId) {
    redirect(loginUrl(`/fi-admin/${tid}/cases`));
  }

  const exists = await assertTenantRowExists(tid);
  if (!exists) {
    redirect("/fi-admin");
  }

  const os = await loadFiOsIdentity(authId);
  if (os && isFiOsCrossTenantDirectoryRole(os.osRole)) {
    return;
  }

  const row = await loadFiUserRow(tid, authId);
  if (!row) {
    redirect("/follicle-intelligence/login?notice=no_tenant_access");
  }
}

/**
 * HairAudit OS hub: production — `fi_admin` or `fi_auditor` platform roles only.
 */
export async function assertHairAuditOsAdminAccess(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const authId = await resolveAuthUserId(null);
  if (!authId) {
    redirect(loginUrl("/hair-audit/admin"));
  }

  const os = await loadFiOsIdentity(authId);
  const r = String(os?.osRole ?? "").trim().toLowerCase();
  if (r !== "fi_auditor" && r !== "fi_admin") {
    redirect("/follicle-intelligence/login?notice=no_audit_access");
  }
}
