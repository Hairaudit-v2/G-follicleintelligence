/**
 * Compatibility adapter: flat graft tray link input → discriminated capture context.
 */

import {
  extractGraftTraySurgeryLinkage,
  isGraftTrayCapture,
  normalizeGraftTraySlotSlug,
  resolveGraftTraySlotVariant,
} from "./imagingGraftTrayBridgeCore";
import type {
  FlatGraftTrayLinkInput,
  GraftTrayCaptureContext,
  GraftTrayContextValidationIssue,
  GraftTrayContextValidationResult,
  GraftTraySurgeryLinkage,
} from "./graftTrayContextTypes";

function flatToCaptureSignals(input: FlatGraftTrayLinkInput) {
  return {
    protocolSlotSlug: input.protocolSlotSlug,
    imageCategory: input.imageCategory,
    anatomicalRegion: input.anatomicalRegion,
    metadata: input.metadata,
  };
}

function buildSurgeryLinkage(input: FlatGraftTrayLinkInput): GraftTraySurgeryLinkage {
  const fromMeta = extractGraftTraySurgeryLinkage(input.metadata);
  return {
    surgery_id: input.surgeryId?.trim() || fromMeta.surgery_id || null,
    case_id: input.caseId?.trim() || fromMeta.case_id || null,
    booking_id: input.bookingId?.trim() || fromMeta.booking_id || null,
    procedure_day_id: fromMeta.procedure_day_id || null,
  };
}

/**
 * Parse flat graft tray link input into a discriminated capture context.
 * Returns null when the image is not a graft tray capture.
 */
export function parseGraftTrayLinkContext(
  input: FlatGraftTrayLinkInput
): GraftTrayCaptureContext | null {
  const signals = flatToCaptureSignals(input);
  if (!isGraftTrayCapture(signals)) {
    return null;
  }

  const slotVariant = resolveGraftTraySlotVariant(signals);
  const normalizedSlot = normalizeGraftTraySlotSlug(
    input.protocolSlotSlug ??
      (typeof input.metadata?.imaging_protocol_slot_slug === "string"
        ? input.metadata.imaging_protocol_slot_slug
        : null)
  );

  const meta = input.metadata ?? {};
  const protocolTemplateSlug =
    typeof meta.protocol_template_slug === "string"
      ? meta.protocol_template_slug
      : typeof meta.imaging_protocol_template_slug === "string"
        ? meta.imaging_protocol_template_slug
        : null;

  return {
    kind: "graft_tray_capture",
    tenant_id: input.tenantId.trim(),
    patient_id: input.patientId.trim(),
    image_id: input.imageId.trim(),
    slot_variant: slotVariant,
    surgery: buildSurgeryLinkage(input),
    protocol: {
      protocol_session_id: input.protocolSessionId?.trim() || null,
      protocol_slot_slug: normalizedSlot || slotVariant,
      protocol_template_slug: protocolTemplateSlug,
      capture_source: input.captureSource?.trim() || "surgery_os",
    },
    image_category: input.imageCategory ?? null,
    anatomical_region: input.anatomicalRegion ?? null,
    captured_by_staff_id: input.capturedByStaffId?.trim() || null,
    metadata: input.metadata,
    quality_needs_review: input.qualityNeedsReview === true,
  };
}

export function validateGraftTrayCaptureContext(
  ctx: GraftTrayCaptureContext
): GraftTrayContextValidationResult {
  const issues: GraftTrayContextValidationIssue[] = [];
  const { surgery, protocol } = ctx;

  if (!protocol.protocol_slot_slug?.trim()) {
    issues.push({
      field: "protocol_slot_slug",
      message: "graft tray link expects a protocol slot slug",
    });
  }

  if (!surgery.surgery_id?.trim() && !surgery.case_id?.trim() && !surgery.booking_id?.trim()) {
    issues.push({
      field: "surgery_id",
      message: "graft tray link expects surgery_id, case_id, or booking_id for SurgeryOS linkage",
    });
  }

  return { valid: issues.length === 0, issues };
}