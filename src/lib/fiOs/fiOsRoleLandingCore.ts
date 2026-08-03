/**
 * FI-TRUST-LANDING-AND-SPINE-1 / D6G nav tidy-up — post-login landing path resolution.
 * All roles land on Today (`/today`). Role-specific deep homes remain available via nav.
 */

/** Path suffix under `/fi-admin/[tenantId]` (leading slash). */
export type FiOsTenantHomePathSuffix = "/today";

/**
 * Resolve where a clinic staff user should land after login (no explicit `next`).
 * D6G: every role lands on Today.
 */
export function resolveFiOsPostLoginPathSuffix(_input?: {
  osRole?: string | null;
  staffRoleKey?: string | null;
  workspaceProfile?: string | null;
  tenantAdminRole?: string | null;
}): FiOsTenantHomePathSuffix {
  return "/today";
}

/** Build absolute FI admin path for a tenant home suffix. */
export function buildFiOsTenantHomeHref(
  tenantId: string,
  suffix: FiOsTenantHomePathSuffix | string = "/today"
): string {
  const tid = tenantId.trim();
  if (!tid) return "/fi-admin";
  const s = String(suffix ?? "").trim();
  if (!s || s === "/") return `/fi-admin/${tid}/today`;
  const normalized = s.startsWith("/") ? s : `/${s}`;
  return `/fi-admin/${tid}${normalized}`;
}
