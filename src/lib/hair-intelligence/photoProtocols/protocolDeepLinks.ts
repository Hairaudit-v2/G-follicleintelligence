/**
 * Deep links for Smart Clinical Photography / protocol workflow routing (FI OS + placeholders for other products).
 */

export function fiOsPatientTwinPhotoProtocolHref(tenantId: string, patientId: string): string {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  return `/fi-admin/${encodeURIComponent(tid)}/patients/${encodeURIComponent(pid)}/twin#smart-photo-protocol`;
}

export function fiOsFoundationPhotoProtocolAnalyticsHref(tenantId: string): string {
  const tid = tenantId.trim();
  return `/fi-admin/${encodeURIComponent(tid)}/foundation-integrity#fi-os-photo-protocol-analytics`;
}

/** Placeholder — HairAudit standalone route not wired in FI repo yet. */
export function hairAuditCasePhotoProtocolHrefPlaceholder(caseId: string): string {
  const id = caseId.trim();
  return `/hairaudit/cases/${encodeURIComponent(id)}/photo-protocol`;
}

/** Placeholder — Hair Longevity intake photography route not wired in FI repo yet. */
export function hairLongevityIntakePhotoProtocolHrefPlaceholder(intakeRecordId: string): string {
  const id = intakeRecordId.trim();
  return `/hair-longevity/intake/${encodeURIComponent(id)}/photo-protocol`;
}
