/**
 * Graft tray image ↔ SurgeryOS bridge (IMAGING-GRAFT-LINK-1). Pure logic.
 */

export const GRAFT_TRAY_SLOT_SLUG = "graft_tray" as const;

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
  const slot = String(input.protocolSlotSlug ?? "").trim().toLowerCase();
  if (slot === GRAFT_TRAY_SLOT_SLUG) return true;

  const meta = input.metadata ?? {};
  const metaSlot =
    typeof meta.imaging_protocol_slot_slug === "string"
      ? meta.imaging_protocol_slot_slug.trim().toLowerCase()
      : "";
  if (metaSlot === GRAFT_TRAY_SLOT_SLUG) return true;

  const category = String(input.imageCategory ?? "").trim().toLowerCase();
  if (category === "graft_tray") return true;

  const region = String(input.anatomicalRegion ?? "").trim().toLowerCase();
  if (region === "graft_tray") return true;

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