/**
 * FI OS tenant scheduling lives under `/fi-admin/:tenantId/calendar` (including nested segments).
 * Used for scroll/layout behaviour only — not for access control.
 */
export function isFiOsTenantCalendarPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3) return false;
  if (parts[0] !== "fi-admin") return false;
  return parts[2] === "calendar";
}
