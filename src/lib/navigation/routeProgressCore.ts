/**
 * Pure helpers for site-wide top-of-page navigation progress.
 * Covers marketing + FI OS soft navigations (App Router).
 */

export type RouteLocation = {
  pathname: string;
  search: string;
};

export const ROUTE_PROGRESS_MIN_VISIBLE_MS = 350;
export const ROUTE_PROGRESS_MAX_MS = 12_000;

export function normalizeRoutePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

export function resolveNavigationUrl(href: string, origin = "http://fi.local"): URL {
  return new URL(href, origin);
}

/** Same-origin path navigation (excludes hash, mailto, tel, external). */
export function isInternalAppNavigationHref(href: string, origin = "http://fi.local"): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") || trimmed.startsWith("javascript:")) {
    return false;
  }

  if (trimmed.startsWith("/")) return true;

  try {
    const url = resolveNavigationUrl(trimmed, origin);
    return url.origin === origin;
  } catch {
    return false;
  }
}

export function isSameRoute(a: RouteLocation, b: RouteLocation): boolean {
  return normalizeRoutePath(a.pathname) === normalizeRoutePath(b.pathname) && a.search === b.search;
}

export function shouldStartRouteProgress(input: {
  href: string;
  current: RouteLocation;
  target?: string | null;
  download?: string | null;
  disabled?: boolean;
  modifiedClick: boolean;
  origin?: string;
}): boolean {
  if (input.modifiedClick) return false;
  if (input.disabled) return false;
  if (input.target?.trim() === "_blank") return false;
  if (input.download != null && input.download !== "") return false;
  if (!isInternalAppNavigationHref(input.href, input.origin)) return false;

  const origin = input.origin ?? "http://fi.local";
  const next = resolveNavigationUrl(input.href, origin);
  const nextLocation: RouteLocation = {
    pathname: next.pathname,
    search: next.search,
  };

  return !isSameRoute(input.current, nextLocation);
}

/** Delay before clearing pending so the bar is perceptible on fast soft navigations. */
export function routeProgressClearDelayMs(
  startedAtMs: number,
  nowMs: number,
  minVisibleMs = ROUTE_PROGRESS_MIN_VISIBLE_MS
): number {
  if (startedAtMs <= 0) return 0;
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return Math.max(0, minVisibleMs - elapsed);
}
