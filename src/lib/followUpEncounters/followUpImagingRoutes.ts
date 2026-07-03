/** Deep links for follow-up encounter imaging capture (no full consultation required). */

export const LEGACY_FOLLOW_UP_CAPTURE_SOURCE = "legacy_follow_up";

export function buildFollowUpImagingCaptureHref(
  tenantId: string,
  patientId: string,
  followUpEncounterId: string,
  protocolSessionId: string,
  opts?: { bookingId?: string }
): string {
  const base = `/fi-admin/${encodeURIComponent(tenantId.trim())}/patients/${encodeURIComponent(patientId.trim())}/imaging`;
  const params = new URLSearchParams({
    tab: "capture",
    intent: "camera",
    source: LEGACY_FOLLOW_UP_CAPTURE_SOURCE,
    followUpEncounterId: followUpEncounterId.trim(),
    protocolSessionId: protocolSessionId.trim(),
  });
  if (opts?.bookingId?.trim()) {
    params.set("returnBookingId", opts.bookingId.trim());
  }
  return `${base}?${params.toString()}`;
}

export function buildFollowUpReturnHref(
  tenantId: string,
  opts: { bookingId?: string; patientId?: string; encounterId?: string }
): string {
  const tid = tenantId.trim();
  if (opts.bookingId?.trim()) {
    return `/fi-admin/${encodeURIComponent(tid)}/calendar?bookingId=${encodeURIComponent(opts.bookingId.trim())}`;
  }
  if (opts.patientId?.trim()) {
    const params = new URLSearchParams({ tab: "timeline" });
    if (opts.encounterId) params.set("encounterId", opts.encounterId.trim());
    return `/fi-admin/${encodeURIComponent(tid)}/patients/${encodeURIComponent(opts.patientId.trim())}?${params.toString()}`;
  }
  return `/fi-admin/${encodeURIComponent(tid)}/patients/returning`;
}

export function buildReturningPatientFlowHref(
  tenantId: string,
  opts?: {
    patientId?: string;
    bookingId?: string;
    encounterType?: string;
    intent?: "follow_up" | "photos" | "legacy";
  }
): string {
  const base = `/fi-admin/${encodeURIComponent(tenantId.trim())}/patients/returning`;
  const params = new URLSearchParams();
  if (opts?.patientId) params.set("patientId", opts.patientId.trim());
  if (opts?.bookingId) params.set("bookingId", opts.bookingId.trim());
  if (opts?.encounterType) params.set("encounterType", opts.encounterType.trim());
  if (opts?.intent) params.set("intent", opts.intent);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseLegacyFollowUpCaptureSource(value: string | null | undefined): boolean {
  return String(value ?? "")
    .trim()
    .toLowerCase() === LEGACY_FOLLOW_UP_CAPTURE_SOURCE;
}
