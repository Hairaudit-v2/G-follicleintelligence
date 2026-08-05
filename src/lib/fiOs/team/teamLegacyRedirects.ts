/**
 * FI-WORKFORCE-COHESION-A2 — legacy workforce route → canonical /team map.
 *
 * Single source of truth for which legacy routes retire into a /team tab.
 * A route only appears here when its canonical target renders equivalent
 * content; everything else stays live (see TEAM_PRESERVED_LEGACY_ROUTES).
 *
 * Matching is EXACT on the suffix after the tenant base — never prefix-based.
 * `/staff` retires while `/staff/link-users` stays live, and `/workforce-os`
 * retires while `/workforce-os/payroll` stays live. Prefix matching would also
 * capture the token-authenticated invite routes nested under `/workforce-os`.
 */

import { isFiAdminTokenPublicRoute } from "@/src/lib/fiOs/fiAdminPublicRoutesCore";

export type TeamLegacyRedirect = {
  /** Path suffix after `/fi-admin/{tenantId}/`. */
  from: string;
  /** Canonical path suffix after `/fi-admin/{tenantId}/`. */
  to: string;
  /** Why the target is equivalent — checked against the pages during A2. */
  basis: string;
};

/** Legacy routes whose canonical /team equivalent renders the same content. */
export const TEAM_LEGACY_REDIRECTS: readonly TeamLegacyRedirect[] = [
  {
    from: "staff",
    to: "team/staff",
    basis: "Both render StaffDirectoryClient via loadStaffDirectoryPage.",
  },
  {
    from: "workforce-os",
    to: "team",
    basis: "Both render WorkforceCommandCentreClient via loadWorkforceCommandCentrePage.",
  },
  {
    from: "workforce-os/roster",
    to: "team/roster",
    basis:
      "Both render RosterCommandCentreView via loadRosterCommandCentrePageData; " +
      "the /team route applies the canonical capability-based tab gate.",
  },
  {
    from: "hr-os/roster",
    to: "team/roster",
    basis: "Previously chained to /workforce-os/roster; now points at the canonical roster.",
  },
  {
    from: "hr-os/onboarding",
    to: "team/onboarding",
    basis: "Identical page: OnboardingCentreClient via loadOnboardingPageModel.",
  },
  {
    from: "hr-os/compliance",
    to: "team/compliance",
    basis: "Identical page: StaffComplianceClient via loadCompliancePageModel.",
  },
  {
    from: "hr-os/certifications",
    to: "team/training",
    basis: "Both render StaffCertificationClient via loadCertificationsPageModel.",
  },
  {
    from: "workforce-os/staff-access",
    to: "team/identity",
    basis:
      "Both render StaffAccessCentreClient via loadStaffAccessCentrePage. Exact-match only: " +
      "the accept/[token] and pin-setup/[setupToken] children stay public and unredirected.",
  },
  // Admin diagnostics moved into the deliberate /team/admin namespace rather
  // than being left on a legacy prefix. Access gates are unchanged by the move.
  {
    from: "workforce-os/staff-identity-audit",
    to: "team/admin/identity-audit",
    basis: "Page moved verbatim; resolveStaffIdentityAuditAccess gate unchanged.",
  },
  {
    from: "workforce-os/hr-task-map",
    to: "team/admin/access-task-map",
    basis: "Page moved verbatim; HR OS role gate and query params unchanged.",
  },
  {
    from: "hr-os/sync-health",
    to: "team/admin/sync-health",
    basis: "Page moved verbatim. The unrelated legacy /hr/sync-health route is untouched.",
  },
] as const;

/**
 * Legacy routes deliberately NOT redirected in A2, with the blocker.
 * Retiring these needs product work, not a redirect — documented so the gap is
 * explicit rather than silently dropped.
 */
export const TEAM_PRESERVED_LEGACY_ROUTES: readonly { suffix: string; reason: string }[] = [
  {
    suffix: "hr-os",
    reason:
      "Unique dashboard (identity + readiness overviews, clinical rostering section) with no /team equivalent.",
  },
  { suffix: "hr-os/credentials", reason: "No /team tab renders StaffCredentialsClient." },
  { suffix: "hr-os/offboarding", reason: "No /team equivalent." },
  { suffix: "hr-os/duplicates", reason: "No /team equivalent." },
  { suffix: "hr-os/staff-reconciliation", reason: "No /team equivalent." },
  {
    suffix: "workforce-os/directory",
    reason: "Lifecycle table distinct from the /team/staff directory.",
  },
  {
    suffix: "workforce-os/planning",
    reason: "Intelligence module reached from Team overview tiles; no tab yet.",
  },
  {
    suffix: "workforce-os/payroll",
    reason: "Intelligence module reached from Team overview tiles; no tab yet.",
  },
  {
    suffix: "workforce-os/shift-cost",
    reason: "Intelligence module reached from Team overview tiles; no tab yet.",
  },
  {
    suffix: "workforce-os/recruitment",
    reason: "Intelligence module reached from Team overview tiles; no tab yet.",
  },
  {
    suffix: "workforce-os/procedure-staffing",
    reason: "Intelligence module reached from Team overview tiles; no tab yet.",
  },
  {
    suffix: "workforce-os/hr-reconciliation",
    reason: "Intelligence module reached from Team overview tiles; no tab yet.",
  },
  { suffix: "staff/link-users", reason: "No /team equivalent." },
  { suffix: "staff/role-review", reason: "No /team equivalent." },
] as const;

function normalizeSuffix(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Path suffix after the tenant base, or null when the path is outside it. */
export function teamLegacySuffixForPath(pathname: string, tenantBase: string): string | null {
  const path = (pathname.split(/[?#]/)[0] ?? pathname).replace(/\/+$/, "");
  const base = tenantBase.replace(/\/+$/, "");
  if (path === base) return "";
  if (!path.startsWith(`${base}/`)) return null;
  return path.slice(base.length + 1);
}

/**
 * Canonical path suffix for a retired legacy route, or null when the path must
 * keep rendering (preserved route, token route, or not a legacy route at all).
 */
export function resolveTeamLegacyRedirectSuffix(
  pathname: string,
  tenantBase: string
): string | null {
  // Defence in depth: token-authenticated routes are never redirected, even if
  // a future entry were to overlap them.
  if (isFiAdminTokenPublicRoute(pathname)) return null;

  const suffix = teamLegacySuffixForPath(pathname, tenantBase);
  if (suffix === null) return null;

  const match = TEAM_LEGACY_REDIRECTS.find((r) => normalizeSuffix(r.from) === normalizeSuffix(suffix));
  return match ? normalizeSuffix(match.to) : null;
}

/** Full canonical href for a retired legacy path, preserving the query string. */
export function resolveTeamLegacyRedirectHref(
  pathname: string,
  tenantBase: string,
  search?: string
): string | null {
  const suffix = resolveTeamLegacyRedirectSuffix(pathname, tenantBase);
  if (suffix === null) return null;
  const base = tenantBase.replace(/\/+$/, "");
  const query = (search ?? "").replace(/^\?/, "");
  return query ? `${base}/${suffix}?${query}` : `${base}/${suffix}`;
}

/**
 * Canonical href for a legacy route identified by its own suffix — used by the
 * retired page files, which know their suffix statically. Returns null when the
 * suffix is not a retired route, so callers keep an explicit fallback.
 */
export function teamLegacyRedirectHrefForSuffix(
  legacySuffix: string,
  tenantBase: string,
  search?: string
): string | null {
  const base = tenantBase.replace(/\/+$/, "");
  const suffix = normalizeSuffix(legacySuffix);
  return resolveTeamLegacyRedirectHref(suffix ? `${base}/${suffix}` : base, tenantBase, search);
}

/** Serializes Next.js searchParams into a query string, dropping empty values. */
export function buildLegacyRedirectQuery(
  raw: Record<string, string | string[] | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const v of value) if (v) qs.append(key, v);
    } else if (value) {
      qs.set(key, value);
    }
  }
  return qs.toString();
}
