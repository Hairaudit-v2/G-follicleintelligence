/** Build configuration hub calendar-tab URL for a clinic scope (serializable; safe for client components). */
export function buildConfigurationCalendarScopeHref(
  tenantId: string,
  organisationId: string | null | undefined,
  clinicId: string | null
): string {
  const params = new URLSearchParams();
  params.set("tab", "calendar");
  if (organisationId?.trim()) {
    params.set("organisationId", organisationId.trim());
  }
  if (clinicId?.trim()) {
    params.set("clinicId", clinicId.trim());
  }
  return `/fi-admin/${tenantId.trim()}/configuration?${params.toString()}`;
}
