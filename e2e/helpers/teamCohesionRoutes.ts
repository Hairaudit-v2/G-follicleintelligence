/**
 * Shared path helpers for FI-TEAM-COHESION authenticated smoke.
 * Mirrors `TEAM_LEGACY_REDIRECTS` / preserved HR OS surfaces for browser assertions.
 */

export type LegacyRedirectCase = {
  fromSuffix: string;
  toSuffix: string;
  label: string;
};

/** Exact-match retired routes → canonical Team targets (query preserved separately). */
export const TEAM_COHESION_REDIRECT_CASES: readonly LegacyRedirectCase[] = [
  { fromSuffix: "staff", toSuffix: "team/staff", label: "staff directory" },
  { fromSuffix: "workforce-os", toSuffix: "team", label: "workforce command centre" },
  { fromSuffix: "workforce-os/roster", toSuffix: "team/roster", label: "workforce roster" },
  { fromSuffix: "hr-os/roster", toSuffix: "team/roster", label: "hr-os roster" },
  { fromSuffix: "hr-os/onboarding", toSuffix: "team/onboarding", label: "hr-os onboarding" },
  { fromSuffix: "hr-os/compliance", toSuffix: "team/compliance", label: "hr-os compliance" },
  { fromSuffix: "hr-os/certifications", toSuffix: "team/training", label: "hr-os certifications" },
  { fromSuffix: "workforce-os/staff-access", toSuffix: "team/identity", label: "staff-access centre" },
  {
    fromSuffix: "workforce-os/staff-identity-audit",
    toSuffix: "team/admin/identity-audit",
    label: "identity audit",
  },
  {
    fromSuffix: "workforce-os/hr-task-map",
    toSuffix: "team/admin/access-task-map",
    label: "access task map",
  },
  { fromSuffix: "hr-os/sync-health", toSuffix: "team/admin/sync-health", label: "sync health" },
] as const;

export type PreservedSurface = {
  suffix: string;
  heading: RegExp;
  label: string;
};

export const TEAM_PRESERVED_HR_OS_SURFACES: readonly PreservedSurface[] = [
  { suffix: "hr-os", heading: /^Team$/i, label: "HR OS dashboard" },
  { suffix: "hr-os/credentials", heading: /Credential/i, label: "credentials" },
  { suffix: "hr-os/offboarding", heading: /Offboard/i, label: "offboarding" },
  { suffix: "hr-os/duplicates", heading: /Duplicate/i, label: "duplicates" },
  {
    suffix: "hr-os/staff-reconciliation",
    heading: /Reconciliation/i,
    label: "staff reconciliation",
  },
] as const;

export type AdminDiagnosticSurface = {
  suffix: string;
  heading: RegExp;
  label: string;
};

export const TEAM_ADMIN_DIAGNOSTIC_SURFACES: readonly AdminDiagnosticSurface[] = [
  {
    suffix: "team/admin/identity-audit",
    heading: /Identity|Readiness|Audit/i,
    label: "identity audit",
  },
  {
    suffix: "team/admin/access-task-map",
    heading: /Access|Task|Map|HR/i,
    label: "access task map",
  },
  {
    suffix: "team/admin/sync-health",
    heading: /Sync|Health/i,
    label: "sync health",
  },
] as const;

export function tenantBase(tenantId: string): string {
  return `/fi-admin/${tenantId}`;
}

export function tenantPath(tenantId: string, suffix: string): string {
  const base = tenantBase(tenantId);
  const clean = suffix.replace(/^\/+/, "").replace(/\/+$/, "");
  return clean ? `${base}/${clean}` : base;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match pathname ignoring trailing slash and optional query. */
export function pathnameEndsWith(pathSuffix: string): RegExp {
  const clean = pathSuffix.replace(/\/+$/, "");
  return new RegExp(`${escapeRegExp(clean)}/?(\\?.*)?$`);
}

export function normalizePathname(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/";
  }
}

/** Labels that must not appear as primary workforce destinations after A1. */
export const RETIRED_PRIMARY_NAV_LABELS = [/Workforce\s*OS/i, /^HR\s*OS$/i] as const;
