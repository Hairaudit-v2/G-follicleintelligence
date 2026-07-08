/**
 * Canonical staff capture policy (IMAGING-CAPTURE-UNIFY-1).
 * Pure — testable without DB.
 */

/** Mirrors VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES — kept here for pure tests. */
const VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES = [
  "patient_profile",
  "patient_slide_over",
  "profile_upload_form",
  "vie_capture_wizard",
  "surgery_os",
  "appointment_procedure",
] as const;

export const CANONICAL_CAPTURE_LEGACY_EXEMPT_SOURCES = [
  "legacy_follow_up",
  "follow_up_encounter",
] as const;

/** Server-ingested or env-gated paths — not subject to staff protocol auto-resolve. */
export const CANONICAL_CAPTURE_INGEST_EXEMPT_SOURCES = [
  "hairaudit",
  "appointment_procedure_admin_fallback",
  "patient_portal",
] as const;

export const CANONICAL_STAFF_PROTOCOL_REQUIRED_SOURCES = [
  ...VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES,
  "imaging_os_wizard",
  "consultation_os",
  "follow_up_outcome",
  "treatment_imaging",
] as const;

export type CanonicalCaptureContext = {
  captureSource: string;
  protocolSessionId: string | null;
  protocolTemplateSlug: string | null;
  protocolSlotSlug: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  surgeryId?: string | null;
};

export function normalizeCanonicalCaptureSource(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export function isCanonicalCaptureLegacyExempt(source: string): boolean {
  return (CANONICAL_CAPTURE_LEGACY_EXEMPT_SOURCES as readonly string[]).includes(source);
}

export function isCanonicalCaptureIngestExempt(source: string): boolean {
  return (CANONICAL_CAPTURE_INGEST_EXEMPT_SOURCES as readonly string[]).includes(source);
}

export function staffCaptureRequiresProtocolSession(source: string): boolean {
  const s = normalizeCanonicalCaptureSource(source);
  if (!s) return true;
  if (isCanonicalCaptureLegacyExempt(s)) return false;
  if (isCanonicalCaptureIngestExempt(s)) return false;
  return (CANONICAL_STAFF_PROTOCOL_REQUIRED_SOURCES as readonly string[]).includes(s);
}

export function assertCanonicalStaffCaptureSource(captureSource: string): void {
  const s = normalizeCanonicalCaptureSource(captureSource);
  if (!s) {
    throw new Error(
      "Clinical photography requires a capture source. Use Start Capture Protocol or ImagingOS guided capture."
    );
  }
}

export function resolveTemplateSlugForCaptureContext(input: {
  captureSource: string;
  templateSlugFromRequest: string | null;
  bookingType?: string | null;
}): string {
  const explicit = input.templateSlugFromRequest?.trim();
  if (explicit) return explicit;

  const source = normalizeCanonicalCaptureSource(input.captureSource);
  if (source === "surgery_os") return "surgery_day";
  if (source === "appointment_procedure") {
    const bt = String(input.bookingType ?? "")
      .trim()
      .toLowerCase();
    if (bt.includes("surgery") || bt.includes("transplant")) return "surgery_day";
    if (bt.includes("follow")) return "follow_up_review";
    return "hair_loss_consultation";
  }
  if (source === "consultation_os") return "hair_loss_consultation";
  if (source === "follow_up_outcome") return "follow_up_review";
  if (source === "legacy_follow_up") return "follow_up_review";
  if (source === "treatment_imaging") return "treatment_scalp_standard";
  return "hair_loss_consultation";
}

export function buildCanonicalCaptureAuditMetadata(input: {
  captureSource: string;
  protocolCatalogSource?: string | null;
  protocolCatalogVersion?: string | null;
  protocolTemplateSlug?: string | null;
  sessionCreated?: boolean;
  sessionReused?: boolean;
}): Record<string, unknown> {
  return {
    canonical_capture_enforced: true,
    canonical_capture_source: normalizeCanonicalCaptureSource(input.captureSource),
    ...(input.protocolCatalogSource ? { protocol_catalog_source: input.protocolCatalogSource } : {}),
    ...(input.protocolCatalogVersion ? { protocol_catalog_version: input.protocolCatalogVersion } : {}),
    ...(input.protocolTemplateSlug ? { protocol_template_slug: input.protocolTemplateSlug } : {}),
    ...(input.sessionCreated ? { canonical_session_created: true } : {}),
    ...(input.sessionReused ? { canonical_session_reused: true } : {}),
  };
}

export function mergeCanonicalCaptureMetadata(
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const root =
    base && typeof base === "object" && !Array.isArray(base) ? { ...base } : {};
  return { ...root, ...patch };
}