/**
 * FI-UX-REBUILD-1 S3.4E — pure helpers for legacy Front Desk redirects.
 * Query whitelist only; no PHI-oriented params forwarded by default.
 */

export const FRONT_DESK_REDIRECT_QUERY_WHITELIST = ["bookingId", "date"] as const;

export type FrontDeskRedirectTarget =
  | { kind: "today" }
  | { kind: "tomorrow" };

/**
 * Build redirect path under /fi-admin/{tenantId}/front-desk[...].
 * Only whitelisted query keys are preserved.
 */
export function buildFrontDeskLegacyRedirectPath(
  tenantId: string,
  target: FrontDeskRedirectTarget,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined> | null
): string {
  const tid = tenantId.trim();
  const base =
    target.kind === "tomorrow"
      ? `/fi-admin/${tid}/front-desk/tomorrow`
      : `/fi-admin/${tid}/front-desk`;

  const allowed = new Set<string>(FRONT_DESK_REDIRECT_QUERY_WHITELIST);
  const out = new URLSearchParams();

  if (searchParams instanceof URLSearchParams) {
    for (const key of FRONT_DESK_REDIRECT_QUERY_WHITELIST) {
      const v = searchParams.get(key);
      if (v != null && v.trim()) out.set(key, v.trim());
    }
  } else if (searchParams && typeof searchParams === "object") {
    for (const key of FRONT_DESK_REDIRECT_QUERY_WHITELIST) {
      const raw = searchParams[key];
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (typeof v === "string" && v.trim() && allowed.has(key)) {
        out.set(key, v.trim());
      }
    }
  }

  // Never forward demo or other unknown params
  const qs = out.toString();
  return qs ? `${base}?${qs}` : base;
}
