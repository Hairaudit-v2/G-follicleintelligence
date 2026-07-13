/**
 * FI-TRUST-LANDING-AND-SPINE-1 — pure post-login landing path resolution.
 * Default tenant home is Today (`""`), not `/cases`.
 */

import { normalizeFiOsRole } from "@/src/lib/fiOs/fiOsRoles";
import { normalizeStaffRoleKey, type StaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

/** Path suffix under `/fi-admin/[tenantId]` (leading slash, or empty for tenant Today home). */
export type FiOsTenantHomePathSuffix =
  | ""
  | "/front-desk"
  | "/crm"
  | "/doctor"
  | "/financial-os"
  | "/team";

/**
 * Resolve where a clinic staff user should land after login (no explicit `next`).
 * Priority: OS role → staff role key → workspace profile hint.
 */
export function resolveFiOsPostLoginPathSuffix(input: {
  osRole?: string | null;
  staffRoleKey?: string | null;
  workspaceProfile?: string | null;
  /** Tenant backend admin role when no staff mapping (e.g. finance_admin). */
  tenantAdminRole?: string | null;
}): FiOsTenantHomePathSuffix {
  const os = normalizeFiOsRole(input.osRole);
  if (os === "fi_consultant") return "/crm";
  if (os === "fi_doctor") return "/doctor";
  if (os === "fi_nurse") return "/front-desk";
  if (os === "fi_clinic_admin") return "";

  const staffRaw = String(input.staffRoleKey ?? "").trim();
  const staff =
    (normalizeStaffRoleKey(staffRaw) as StaffRoleKey | null) ??
    (staffRaw ? (staffRaw.toLowerCase() as StaffRoleKey) : null);

  if (staff === "reception") return "/front-desk";
  if (staff === "consultant") return "/crm";
  if (staff === "doctor") return "/doctor";
  if (staff === "nurse") return "/front-desk";
  if (staff === "owner" || staff === "manager") return "";
  if (staff === "trainer") return "/team";
  if (staff === "auditor") return "";

  // Unnormalized production labels (e.g. "Contractor Doctor / Hair Transplant Surgeon").
  const staffLower = staffRaw.toLowerCase();
  if (staffLower.includes("reception")) return "/front-desk";
  if (staffLower.includes("consultant")) return "/crm";
  if (staffLower.includes("surgeon") || staffLower.includes("doctor")) return "/doctor";
  if (staffLower.includes("nurse")) return "/front-desk";

  const admin = String(input.tenantAdminRole ?? "")
    .trim()
    .toLowerCase();
  if (admin === "finance_admin") return "/financial-os";
  if (admin === "operations_admin") return "/front-desk";
  if (admin === "clinic_admin") return "";
  if (admin === "dashboard_viewer") return "";

  const profile = String(input.workspaceProfile ?? "")
    .trim()
    .toLowerCase();
  if (profile === "reception") return "/front-desk";
  if (profile === "consultant") return "/crm";
  if (profile === "doctor" || profile === "surgeon") return "/doctor";
  if (profile === "nurse") return "/front-desk";
  if (profile === "director" || profile === "clinic_manager") return "";
  if (profile === "academy_trainer") return "/team";

  // Default: Today (operational home), never Cases.
  return "";
}

/** Build absolute FI admin path for a tenant home suffix. */
export function buildFiOsTenantHomeHref(
  tenantId: string,
  suffix: FiOsTenantHomePathSuffix | string = ""
): string {
  const tid = tenantId.trim();
  if (!tid) return "/fi-admin";
  const s = String(suffix ?? "").trim();
  if (!s || s === "/") return `/fi-admin/${tid}`;
  const normalized = s.startsWith("/") ? s : `/${s}`;
  return `/fi-admin/${tid}${normalized}`;
}
