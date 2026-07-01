/**
 * ImagingOS Phase 3 — scalp region link enforcement for donor/recipient protocol slots.
 */

const VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES = [
  "patient_profile",
  "patient_slide_over",
  "profile_upload_form",
  "vie_capture_wizard",
  "surgery_os",
  "appointment_procedure",
] as const;

function normalizeCaptureSource(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function isVieProtocolRequiredSource(source: string): boolean {
  return (VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES as readonly string[]).includes(source);
}

export type ScalpRegionComplianceInput = {
  captureSource?: string | null;
  protocolSessionId?: string | null;
  protocolSlotSlug?: string | null;
  viewType?: string | null;
  anatomicalRegion?: string | null;
  hasRegionLink?: boolean;
  isAdminFallback?: boolean;
  capturedBeforeEnforcement?: boolean;
};

export type ScalpRegionComplianceResult = {
  passes: boolean;
  reviewRequired: boolean;
  reasons: string[];
  expectedRegionKind: "donor" | "recipient" | null;
};

const DONOR_SLOT_HINTS = new Set([
  "donor",
  "donor_close",
  "donor_before_extraction",
  "donor_during_extraction",
  "donor_final_extraction",
  "pre_op_donor",
  "pre_op_donor_close",
  "immediate_post_op_donor",
  "postop_donor",
]);

const RECIPIENT_SLOT_HINTS = new Set([
  "recipient",
  "recipient_midscalp",
  "recipient_crown",
  "recipient_sites",
  "recipient_zone",
  "recipient_close",
  "immediate_post_op_recipient",
]);

const DONOR_VIEW_TYPES = new Set(["donor", "microscopic"]);
const RECIPIENT_VIEW_TYPES = new Set([
  "recipient",
  "hairline",
  "front",
  "top",
  "crown",
  "temporal",
  "vertex",
]);

const DONOR_REGIONS = new Set(["donor", "body_hair"]);
const RECIPIENT_REGIONS = new Set([
  "hairline",
  "frontal_third",
  "midscalp",
  "crown",
  "temple_left",
  "temple_right",
  "global",
  "beard",
  "eyebrow",
]);

function normalizeSlot(slug: string | null | undefined): string {
  return String(slug ?? "")
    .trim()
    .toLowerCase();
}

function normalizeRegion(region: string | null | undefined): string {
  return String(region ?? "")
    .trim()
    .toLowerCase();
}

function normalizeView(view: string | null | undefined): string {
  return String(view ?? "")
    .trim()
    .toLowerCase();
}

export function resolveExpectedScalpRegionKind(
  input: Pick<ScalpRegionComplianceInput, "protocolSlotSlug" | "viewType">
): "donor" | "recipient" | null {
  const slot = normalizeSlot(input.protocolSlotSlug);
  if (slot && DONOR_SLOT_HINTS.has(slot)) return "donor";
  if (slot && RECIPIENT_SLOT_HINTS.has(slot)) return "recipient";

  const view = normalizeView(input.viewType);
  if (DONOR_VIEW_TYPES.has(view)) return "donor";
  if (RECIPIENT_VIEW_TYPES.has(view)) return "recipient";
  return null;
}

export function isProtocolCaptureContext(input: {
  captureSource?: string | null;
  protocolSessionId?: string | null;
}): boolean {
  const source = normalizeCaptureSource(input.captureSource);
  if (source === "imaging_os_wizard") return Boolean(input.protocolSessionId?.trim());
  if (source === "appointment_procedure_admin_fallback") return Boolean(input.protocolSessionId?.trim());
  return isVieProtocolRequiredSource(source) && Boolean(input.protocolSessionId?.trim());
}

export function hasDonorScalpRegionContext(input: {
  anatomicalRegion?: string | null;
  hasRegionLink?: boolean;
}): boolean {
  if (input.hasRegionLink) return true;
  const region = normalizeRegion(input.anatomicalRegion);
  return DONOR_REGIONS.has(region);
}

export function hasRecipientScalpRegionContext(input: {
  anatomicalRegion?: string | null;
  hasRegionLink?: boolean;
}): boolean {
  if (input.hasRegionLink) return true;
  const region = normalizeRegion(input.anatomicalRegion);
  return RECIPIENT_REGIONS.has(region);
}

/**
 * Validates scalp region context for protocol-driven donor/recipient captures.
 * Historical images without protocol session are unaffected.
 */
export function evaluateScalpRegionCompliance(
  input: ScalpRegionComplianceInput
): ScalpRegionComplianceResult {
  if (input.capturedBeforeEnforcement) {
    return { passes: true, reviewRequired: false, reasons: [], expectedRegionKind: null };
  }

  const expectedKind = resolveExpectedScalpRegionKind(input);
  if (!expectedKind) {
    return { passes: true, reviewRequired: false, reasons: [], expectedRegionKind: null };
  }

  if (!isProtocolCaptureContext(input)) {
    return { passes: true, reviewRequired: false, reasons: [], expectedRegionKind: expectedKind };
  }

  const hasRegion =
    expectedKind === "donor"
      ? hasDonorScalpRegionContext(input)
      : hasRecipientScalpRegionContext(input);

  if (hasRegion) {
    return { passes: true, reviewRequired: false, reasons: [], expectedRegionKind: expectedKind };
  }

  const reasons = [
    expectedKind === "donor" ? "missing_donor_scalp_region" : "missing_recipient_scalp_region",
  ];
  if (input.isAdminFallback) {
    reasons.push("admin_fallback_missing_region");
  }

  return {
    passes: false,
    reviewRequired: true,
    reasons,
    expectedRegionKind: expectedKind,
  };
}