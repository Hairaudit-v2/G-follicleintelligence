/**
 * Pure helpers for FI OS route-transition pending state (click capture + reset rules).
 */

export const FI_OS_NAV_PENDING_ATTR = "data-fi-os-nav-id" as const;

export type FiOsRouteLocation = {
  pathname: string;
  search: string;
};

export function normalizeFiOsNavPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

export function resolveFiOsNavigationUrl(href: string, origin = "http://fi.local"): URL {
  return new URL(href, origin);
}

export function isInternalFiOsNavigationHref(href: string, origin = "http://fi.local"): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return false;

  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("/fi-admin/") || trimmed === "/fi-admin";
  }

  try {
    const url = resolveFiOsNavigationUrl(trimmed, origin);
    if (url.origin !== origin) return false;
    return url.pathname.startsWith("/fi-admin/") || url.pathname === "/fi-admin";
  } catch {
    return false;
  }
}

export function isModifiedNavigationClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  defaultPrevented: boolean;
}): boolean {
  if (event.defaultPrevented) return true;
  if (event.button !== 0) return true;
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function isSameFiOsRoute(a: FiOsRouteLocation, b: FiOsRouteLocation): boolean {
  return normalizeFiOsNavPath(a.pathname) === normalizeFiOsNavPath(b.pathname) && a.search === b.search;
}

export function shouldStartFiOsNavigationPending(input: {
  href: string;
  current: FiOsRouteLocation;
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
  if (!isInternalFiOsNavigationHref(input.href, input.origin)) return false;

  const origin = input.origin ?? "http://fi.local";
  const next = resolveFiOsNavigationUrl(input.href, origin);
  const nextLocation: FiOsRouteLocation = {
    pathname: next.pathname,
    search: next.search,
  };

  if (isSameFiOsRoute(input.current, nextLocation)) {
    return false;
  }

  return true;
}

export function readFiOsNavIdFromAnchor(anchor: { getAttribute(name: string): string | null }): string | null {
  const id = anchor.getAttribute(FI_OS_NAV_PENDING_ATTR)?.trim();
  return id || null;
}
