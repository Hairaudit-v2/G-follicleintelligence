/** WorkforceOS roster standard-hours setup routes (fi_staff.id). */

export const STAFF_STANDARD_HOURS_MANAGE_DENIED_REASON =
  "You do not have permission to edit standard hours.";

export const ROSTER_MANAGE_DENIED_REASON = "You do not have permission to edit roster shifts.";

export function buildStaffStandardHoursSetupIndexHref(tenantId: string): string {
  return `/fi-admin/${tenantId.trim()}/workforce-os/roster/standard-hours`;
}

export function buildStaffStandardHoursEditorHref(
  tenantId: string,
  staffId: string,
  options?: { returnTo?: string | null }
): string {
  const base = `/fi-admin/${tenantId.trim()}/workforce-os/roster/standard-hours/${staffId.trim()}`;
  const returnTo = options?.returnTo?.trim();
  if (!returnTo) return base;
  const params = new URLSearchParams({ returnTo });
  return `${base}?${params.toString()}`;
}

export function buildStaffStandardHoursReturnToRosterHref(tenantId: string): string {
  return `/fi-admin/${tenantId.trim()}/workforce-os/roster`;
}

/** Staff employment / lifecycle profile used from roster ineligible list and HR deep links. */
export function buildWorkforceStaffProfileHref(tenantId: string, staffId: string): string {
  return `/fi-admin/${tenantId.trim()}/workforce-os/staff/${staffId.trim()}`;
}
