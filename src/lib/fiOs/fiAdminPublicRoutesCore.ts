/**
 * FI Admin routes that are intentionally public at the middleware / layout layer.
 * Token-gated onboarding and staff-access flows must not require an admin session.
 */

export function isFiAdminTokenPublicRoute(pathname: string): boolean {
  return (
    pathname.includes("/onboarding/invite/") ||
    pathname.includes("/workforce-os/staff-access/accept/") ||
    pathname.includes("/workforce-os/staff-access/pin-setup/")
  );
}

export function isFiAdminPinPublicRoute(pathname: string): boolean {
  return pathname.includes("/staff-pin-login") || pathname.includes("/staff-time-clock");
}

export function isFiAdminPublicSubpath(pathname: string): boolean {
  return isFiAdminPinPublicRoute(pathname) || isFiAdminTokenPublicRoute(pathname);
}
