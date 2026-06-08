import "server-only";

import { cache } from "react";
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

async function hasActiveFiStaffForFiUser(tenantId: string, fiUserId: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("fi_staff")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId.trim())
    .eq("fi_user_id", fiUserId.trim())
    .eq("is_active", true);
  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Tenant user row allowed to use the bookings operator board and appointment slide-over
 * (CRM shell roles, or clinical `member` linked to active `fi_staff` for this tenant).
 */
async function resolveBookingsOperatorEligibleFiUserRow(
  tenantId: string,
  authUserId: string
): Promise<{ id: string; role: string } | null> {
  const tid = tenantId.trim();
  const row = await loadFiUserRow(tid, authUserId);
  if (!row) return null;
  if (isCrmShellNavRole(row.role)) return row;
  if (String(row.role ?? "").trim().toLowerCase() === "member" && (await hasActiveFiStaffForFiUser(tid, row.id))) return row;
  return null;
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
 * Enforce Stage 2E route gate (cached per request). Used by CRM layout and pages so auth is not loaded twice.
 * Redirects to tenant Cases if unauthorised.
 */
export const getCrmShellPageSession = cache(async (tenantId: string): Promise<CrmShellSession> => {
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
});

export async function assertCrmShellPageAccess(tenantId: string): Promise<CrmShellSession> {
  return getCrmShellPageSession(tenantId);
}

/**
 * Same membership check as {@link assertCrmShellPageAccess} without redirect — for server actions
 * and other callers that need an explicit null when unauthorised.
 */
export async function getCrmShellSessionIfAllowed(tenantId: string): Promise<CrmShellSession | null> {
  const tid = tenantId.trim();
  if (!tid) return null;
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  const row = await loadFiUserRow(tid, authId);
  if (!row || !isCrmShellNavRole(row.role)) return null;
  return { authUserId: authId, fiUserId: row.id, role: row.role };
}

/**
 * Bookings operator + appointment tooling: CRM shell roles, or `member` with an active
 * `fi_staff` row for this tenant (scheduling without CRM leads access).
 *
 * Same predicate as {@link getBookingsOperatorPageSession} / {@link getBookingsOperatorSessionIfAllowed}
 * (PatientOS `/fi-admin/[tenantId]/patients/*` layout gate). Use this (or the session helpers) for shell
 * visibility so nav matches route access.
 */
export async function getBookingsBoardNavAllowed(tenantId: string): Promise<boolean> {
  const tid = tenantId.trim();
  if (!tid) return false;
  const authId = await resolveAuthUserId(null);
  if (!authId) return false;
  return (await resolveBookingsOperatorEligibleFiUserRow(tid, authId)) !== null;
}

export const getBookingsOperatorPageSession = cache(async (tenantId: string): Promise<CrmShellSession> => {
  const tid = tenantId.trim();
  if (!tid) redirect("/fi-admin");

  const authId = await resolveAuthUserId(null);
  if (!authId) redirect("/fi-admin");

  const row = await resolveBookingsOperatorEligibleFiUserRow(tid, authId);
  if (!row) redirect(`/fi-admin/${tid}/cases`);

  return { authUserId: authId, fiUserId: row.id, role: row.role };
});

export async function assertBookingsOperatorPageAccess(tenantId: string): Promise<CrmShellSession> {
  return getBookingsOperatorPageSession(tenantId);
}

export async function getBookingsOperatorSessionIfAllowed(tenantId: string): Promise<CrmShellSession | null> {
  const tid = tenantId.trim();
  if (!tid) return null;
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  const row = await resolveBookingsOperatorEligibleFiUserRow(tid, authId);
  if (!row) return null;
  return { authUserId: authId, fiUserId: row.id, role: row.role };
}

/**
 * Any tenant `fi_users` row (for modules that are not restricted to CRM/bookings-operator roles).
 */
export async function getFiTenantMemberSessionIfAllowed(tenantId: string): Promise<CrmShellSession | null> {
  const tid = tenantId.trim();
  if (!tid) return null;
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  const row = await loadFiUserRow(tid, authId);
  if (!row) return null;
  return { authUserId: authId, fiUserId: row.id, role: row.role };
}
