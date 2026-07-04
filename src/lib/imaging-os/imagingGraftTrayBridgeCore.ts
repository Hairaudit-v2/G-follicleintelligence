/**
 * Graft tray image ↔ SurgeryOS bridge (IMAGING-GRAFT-LINK-1). Pure logic.
 */

export const GRAFT_TRAY_SLOT_SLUG = "graft_tray" as const;

export const GRAFT_TRAY_SLOT_VARIANTS = [
  "graft_tray",
  "graft_tray_overview",
  "graft_tray_close",
] as const;

export type GraftTraySlotVariant = (typeof GRAFT_TRAY_SLOT_VARIANTS)[number];

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function normalizeGraftTraySlotSlug(
  value: string | null | undefined
): GraftTraySlotVariant | null {
  const slot = normalizeKey(value);
  if (!slot) return null;
  if ((GRAFT_TRAY_SLOT_VARIANTS as readonly string[]).includes(slot)) {
    return slot as GraftTraySlotVariant;
  }
  if (slot.startsWith("graft_tray")) {
    return slot as GraftTraySlotVariant;
  }
  return null;
}

export function resolveGraftTraySlotVariant(input: {
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  metadata?: Record<string, unknown> | null;
}): GraftTraySlotVariant {
  const fromSlot = normalizeGraftTraySlotSlug(input.protocolSlotSlug);
  if (fromSlot) return fromSlot;

  const meta = input.metadata ?? {};
  const metaSlot = normalizeGraftTraySlotSlug(
    typeof meta.imaging_protocol_slot_slug === "string"
      ? meta.imaging_protocol_slot_slug
      : typeof meta.protocol_slot_slug === "string"
        ? meta.protocol_slot_slug
        : null
  );
  if (metaSlot) return metaSlot;

  const vieContext =
    meta.vie_surgery_context && typeof meta.vie_surgery_context === "object"
      ? (meta.vie_surgery_context as Record<string, unknown>)
      : null;
  const fromVie = normalizeGraftTraySlotSlug(
    typeof vieContext?.slot_slug === "string" ? vieContext.slot_slug : null
  );
  if (fromVie) return fromVie;

  if (normalizeKey(input.imageCategory) === "graft_tray") return GRAFT_TRAY_SLOT_SLUG;
  if (normalizeKey(input.anatomicalRegion) === "graft_tray") return GRAFT_TRAY_SLOT_SLUG;

  return GRAFT_TRAY_SLOT_SLUG;
}

export function extractGraftTraySurgeryLinkage(
  metadata?: Record<string, unknown> | null
): {
  surgery_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  procedure_day_id: string | null;
} {
  const meta = metadata ?? {};
  const surgeryContext =
    meta.surgery_context && typeof meta.surgery_context === "object"
      ? (meta.surgery_context as Record<string, unknown>)
      : null;
  const vieContext =
    meta.vie_surgery_context && typeof meta.vie_surgery_context === "object"
      ? (meta.vie_surgery_context as Record<string, unknown>)
      : null;

  const pick = (primary: unknown, fallback: unknown): string | null => {
    const value = typeof primary === "string" && primary.trim() ? primary.trim() : null;
    if (value) return value;
    return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
  };

  return {
    surgery_id: pick(surgeryContext?.surgery_id, vieContext?.surgery_id),
    case_id: pick(surgeryContext?.case_id, vieContext?.case_id),
    booking_id: pick(surgeryContext?.booking_id, vieContext?.booking_id),
    procedure_day_id: pick(surgeryContext?.procedure_day_id, vieContext?.procedure_day_id),
  };
}

export const GRAFT_TRAY_LINK_STATUSES = [
  "linked",
  "review_required",
  "mismatch_flagged",
  "superseded",
] as const;

export type GraftTrayLinkStatus = (typeof GRAFT_TRAY_LINK_STATUSES)[number];

export const GRAFT_TRAY_REVIEW_REASONS = [
  "graft_tray_missing_protocol_slot",
  "graft_tray_reconciliation_evidence_required",
  "graft_tray_count_mismatch_placeholder",
  "graft_tray_quality_review",
] as const;

export type GraftTrayReviewReason = (typeof GRAFT_TRAY_REVIEW_REASONS)[number];

export function parseRequireGraftTrayCaptureFlag(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return env.FI_IMAGING_REQUIRE_GRAFT_TRAY_CAPTURE === "true";
}

export function isGraftTrayCapture(input: {
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (normalizeGraftTraySlotSlug(input.protocolSlotSlug)) return true;

  const meta = input.metadata ?? {};
  if (
    normalizeGraftTraySlotSlug(
      typeof meta.imaging_protocol_slot_slug === "string"
        ? meta.imaging_protocol_slot_slug
        : typeof meta.protocol_slot_slug === "string"
          ? meta.protocol_slot_slug
          : null
    )
  ) {
    return true;
  }

  const vieContext =
    meta.vie_surgery_context && typeof meta.vie_surgery_context === "object"
      ? (meta.vie_surgery_context as Record<string, unknown>)
      : null;
  if (
    normalizeGraftTraySlotSlug(
      typeof vieContext?.slot_slug === "string" ? vieContext.slot_slug : null
    )
  ) {
    return true;
  }

  if (normalizeKey(input.imageCategory) === "graft_tray") return true;
  if (normalizeKey(input.anatomicalRegion) === "graft_tray") return true;

  return false;
}

export function deriveGraftTrayReviewReasons(input: {
  reviewRequired?: boolean;
  missingProtocolSlot?: boolean;
  qualityNeedsReview?: boolean;
  reconciliationEvidenceRequired?: boolean;
  mismatchPlaceholder?: boolean;
}): GraftTrayReviewReason[] {
  const reasons: GraftTrayReviewReason[] = [];
  if (input.missingProtocolSlot) reasons.push("graft_tray_missing_protocol_slot");
  if (input.reconciliationEvidenceRequired || input.reviewRequired) {
    reasons.push("graft_tray_reconciliation_evidence_required");
  }
  if (input.mismatchPlaceholder) reasons.push("graft_tray_count_mismatch_placeholder");
  if (input.qualityNeedsReview) reasons.push("graft_tray_quality_review");
  return [...new Set(reasons)];
}

export function assessGraftTrayCaptureGate(input: {
  trayImageCount: number;
  requireTrayCapture: boolean;
}): string | null {
  if (!input.requireTrayCapture) return null;
  if (input.trayImageCount < 1) {
    return (
      "At least one graft tray photo is required before final reconciliation. " +
      "Open Surgery Day capture and photograph the graft tray."
    );
  }
  return null;
}

export function buildGraftTrayLinkMetadata(input: {
  captureSource: string;
  protocolSessionId?: string | null;
  surgeryContext?: Record<string, unknown> | null;
}): Record<string, unknown> {
  return {
    bridge: "imaging_graft_tray_link_v1",
    capture_source: input.captureSource,
    ...(input.protocolSessionId ? { protocol_session_id: input.protocolSessionId } : {}),
    ...(input.surgeryContext ? { surgery_context: input.surgeryContext } : {}),
  };
}