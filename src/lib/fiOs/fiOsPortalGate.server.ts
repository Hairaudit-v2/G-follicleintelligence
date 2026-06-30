import "server-only";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { getFiOsImpersonationTargetAuthUserId } from "@/src/lib/fiOs/fiOsImpersonation.server";

import { getStaffPinClinicSessionIfValid } from "@/src/lib/staffPin/staffPinSession.server";

import { isFiOsCrossTenantDirectoryRole } from "./fiOsRoles";
import { isFiPortalStaff, loadFiOsIdentity } from "./fiOsIdentity.server";

async function resolveTenantPortalMembershipAuthUserId(sessionAuthUserId: string): Promise<string> {
  const imp = await getFiOsImpersonationTargetAuthUserId(sessionAuthUserId);
  return imp ?? sessionAuthUserId;
}

async function loadFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string; auth_user_id: string | null } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role, auth_user_id")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  const r = data as { id: string; role: string | null; auth_user_id: string | null };
  return {
    id: String(r.id),
    role: String(r.role ?? "member"),
    auth_user_id: r.auth_user_id ? String(r.auth_user_id) : null,
  };
}

/**
 * `fi_users.role = tenant_backend` is only for non-clinical admin access; require a matching
 * `fi_tenant_admin_users` row. Invited users may enter after auth confirms or first sign-in.
 */
async function assertTenantBackendPortalAllowed(
  tenantId: string,
  row: { id: string; role: string; auth_user_id: string | null }
): Promise<boolean> {
  const role = row.role.trim().toLowerCase();
  if (role !== "tenant_backend") return true;

  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: adm, error } = await supabase
    .from("fi_tenant_admin_users")
    .select("id, status")
    .eq("tenant_id", tid)
    .eq("fi_user_id", row.id)
    .maybeSingle();
  if (error || !adm) return false;

  const st = String((adm as { status: string }).status)
    .trim()
    .toLowerCase();
  if (st === "suspended") return false;
  if (st === "active") return true;

  if (st !== "invited") return false;
  const authUid = row.auth_user_id?.trim();
  if (!authUid) return false;

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(authUid);
  if (authErr || !authUser?.user) return false;
  const u = authUser.user;
  const ready = Boolean(u.email_confirmed_at || u.last_sign_in_at);
  if (!ready) return false;

  const adminId = String((adm as { id: string }).id);
  await supabase
    .from("fi_tenant_admin_users")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", adminId)
    .eq("tenant_id", tid);

  return true;
}

async function assertTenantRowExists(tenantId: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId.trim())
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

function loginUrl(nextPath: string): string {
  const q = new URLSearchParams();
  q.set("next", nextPath);
  return `/follicle-intelligence/login?${q.toString()}`;
}

/** Tenant row must exist (kiosk PIN entry and PIN sessions do not require Supabase membership). */
export async function assertFiTenantExists(tenantId: string): Promise<void> {
  const tid = tenantId.trim();
  if (!tid) redirect("/fi-admin");
  const exists = await assertTenantRowExists(tid);
  if (!exists) redirect("/fi-admin");
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

  const principal = await resolveTenantPortalMembershipAuthUserId(authId);
  const row = await loadFiUserRow(tid, principal);
  if (!row) {
    redirect("/follicle-intelligence/login?notice=no_tenant_access");
  }

  const backendOk = await assertTenantBackendPortalAllowed(tid, row);
  if (!backendOk) {
    redirect("/follicle-intelligence/login?notice=no_tenant_access");
  }
}

/**
 * Production gate for routes that may run on a clinic-floor **staff PIN** session without a
 * Supabase operator user (e.g. reception kiosk). When a valid PIN cookie is present, skip the
 * normal FI portal membership check; otherwise require {@link assertFiTenantPortalAccess}.
 */
export async function assertFiTenantPortalAccessUnlessStaffPinSession(
  tenantId: string
): Promise<void> {
  const pin = await getStaffPinClinicSessionIfValid(tenantId.trim());
  if (pin) return;
  await assertFiTenantPortalAccess(tenantId);
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
  const r = String(os?.osRole ?? "")
    .trim()
    .toLowerCase();
  if (r !== "fi_auditor" && r !== "fi_admin" && r !== "fi_platform_admin") {
    redirect("/follicle-intelligence/login?notice=no_audit_access");
  }
}
