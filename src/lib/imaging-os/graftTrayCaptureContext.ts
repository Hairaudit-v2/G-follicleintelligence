/**
 * Cohesive graft tray capture context (FI-IMAGING-GRAFT-TRAY-CONTEXT-1).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionCore";
import {
  buildGraftTrayLinkMetadata,
  deriveGraftTrayReviewReasons,
  extractGraftTraySurgeryLinkage,
  isGraftTrayCapture,
  normalizeGraftTraySlotSlug,
  resolveGraftTraySlotVariant,
  type GraftTrayLinkStatus,
  type GraftTraySlotVariant,
} from "./imagingGraftTrayBridgeCore";

/** Legacy flat input accepted by linkGraftTrayImageAfterCapture (compatibility). */
export type FlatGraftTrayLinkInput = {
  tenantId: string;
  patientId: string;
  imageId: string;
  protocolSessionId?: string | null;
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  caseId?: string | null;
  bookingId?: string | null;
  surgeryId?: string | null;
  capturedByStaffId?: string | null;
  captureSource?: string | null;
  metadata?: Record<string, unknown>;
  qualityNeedsReview?: boolean;
  client?: SupabaseClient;
};

export type GraftTrayCaptureSlotContext = {
  protocolSessionId?: string | null;
  protocolSlotSlug?: string | null;
  imageCategory?: string | null;
  anatomicalRegion?: string | null;
  slotVariant?: GraftTraySlotVariant | null;
};

export type GraftTraySurgeryContextFields = {
  caseId?: string | null;
  bookingId?: string | null;
  surgeryId?: string | null;
  capturedByStaffId?: string | null;
  procedureDayId?: string | null;
};

export type GraftTrayCaptureMeta = {
  captureSource: string;
  qualityNeedsReview?: boolean;
  metadata?: Record<string, unknown>;
};

export type GraftTrayCaptureContext = {
  tenantId: string;
  patientId: string;
  imageId: string;
  slot: GraftTrayCaptureSlotContext;
  surgeryContext: GraftTraySurgeryContextFields;
  capture: GraftTrayCaptureMeta;
};

export type GraftTrayCaptureContextValidationIssue = {
  field: string;
  message: string;
};

export type GraftTrayCaptureContextValidationResult = {
  valid: boolean;
  issues: GraftTrayCaptureContextValidationIssue[];
};

export type GraftTrayLinkInsertRow = {
  tenant_id: string;
  patient_id: string;
  image_id: string;
  surgery_case_id: string | null;
  surgery_id: string | null;
  booking_id: string | null;
  graft_session_id: string | null;
  graft_count_event_id: string | null;
  protocol_session_id: string | null;
  protocol_slot_slug: string;
  captured_by_staff_id: string | null;
  status: GraftTrayLinkStatus;
  review_required: boolean;
  mismatch_reason: string | null;
  metadata: Record<string, unknown>;
};

export type GraftTrayImageMetadataPatch = {
  graft_tray_link_id: string;
  graft_tray_review_reasons: ReturnType<typeof deriveGraftTrayReviewReasons>;
  graft_tray_reconciliation_evidence: boolean;
  graft_tray_slot_variant: GraftTraySlotVariant;
};

function captureSignalsFromContext(ctx: GraftTrayCaptureContext) {
  return {
    protocolSlotSlug: ctx.slot.protocolSlotSlug,
    imageCategory: ctx.slot.imageCategory,
    anatomicalRegion: ctx.slot.anatomicalRegion,
    metadata: ctx.capture.metadata,
  };
}

function buildSurgeryContextFields(input: FlatGraftTrayLinkInput): GraftTraySurgeryContextFields {
  const fromMeta = extractGraftTraySurgeryLinkage(input.metadata);
  return {
    surgeryId: input.surgeryId?.trim() || fromMeta.surgery_id || null,
    caseId: input.caseId?.trim() || fromMeta.case_id || null,
    bookingId: input.bookingId?.trim() || fromMeta.booking_id || null,
    capturedByStaffId: input.capturedByStaffId?.trim() || null,
    procedureDayId: fromMeta.procedure_day_id || null,
  };
}

function buildSlotContext(input: FlatGraftTrayLinkInput): GraftTrayCaptureSlotContext {
  const signals = {
    protocolSlotSlug: input.protocolSlotSlug,
    imageCategory: input.imageCategory,
    anatomicalRegion: input.anatomicalRegion,
    metadata: input.metadata,
  };
  const slotVariant = isGraftTrayCapture(signals) ? resolveGraftTraySlotVariant(signals) : null;
  const normalizedSlot = normalizeGraftTraySlotSlug(
    input.protocolSlotSlug ??
      (typeof input.metadata?.imaging_protocol_slot_slug === "string"
        ? input.metadata.imaging_protocol_slot_slug
        : null)
  );

  return {
    protocolSessionId: input.protocolSessionId?.trim() || null,
    protocolSlotSlug: normalizedSlot || slotVariant || input.protocolSlotSlug?.trim() || null,
    imageCategory: input.imageCategory ?? null,
    anatomicalRegion: input.anatomicalRegion ?? null,
    slotVariant,
  };
}

/**
 * Parse legacy flat link input into grouped graft tray capture context.
 */
export function parseGraftTrayCaptureContext(input: FlatGraftTrayLinkInput): GraftTrayCaptureContext {
  const rawCaptureSource = input.captureSource?.trim() || "surgery_os";
  return {
    tenantId: input.tenantId.trim(),
    patientId: input.patientId.trim(),
    imageId: input.imageId.trim(),
    slot: buildSlotContext(input),
    surgeryContext: buildSurgeryContextFields(input),
    capture: {
      captureSource: normalizeFiImageCaptureSource(rawCaptureSource),
      qualityNeedsReview: input.qualityNeedsReview === true,
      metadata:
        input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
          ? input.metadata
          : {},
    },
  };
}

/** Alias for call sites that construct context from already-grouped route data. */
export const buildGraftTrayCaptureContext = parseGraftTrayCaptureContext;

export function isGroupedGraftTrayCaptureContext(
  input: FlatGraftTrayLinkInput | GraftTrayCaptureContext
): input is GraftTrayCaptureContext {
  return "slot" in input && "surgeryContext" in input && "capture" in input;
}

export function resolveGraftTrayCaptureContext(
  input: FlatGraftTrayLinkInput | GraftTrayCaptureContext
): GraftTrayCaptureContext {
  return isGroupedGraftTrayCaptureContext(input) ? input : parseGraftTrayCaptureContext(input);
}

export function isGraftTrayLinkEligible(ctx: GraftTrayCaptureContext): boolean {
  return isGraftTrayCapture(captureSignalsFromContext(ctx));
}

export function validateGraftTrayCaptureContext(
  ctx: GraftTrayCaptureContext
): GraftTrayCaptureContextValidationResult {
  const issues: GraftTrayCaptureContextValidationIssue[] = [];

  if (!ctx.tenantId.trim()) {
    issues.push({ field: "tenantId", message: "tenantId is required" });
  }
  if (!ctx.patientId.trim()) {
    issues.push({ field: "patientId", message: "patientId is required" });
  }
  if (!ctx.imageId.trim()) {
    issues.push({ field: "imageId", message: "imageId is required" });
  }

  if (isGraftTrayLinkEligible(ctx) && !ctx.slot.protocolSlotSlug?.trim()) {
    issues.push({
      field: "slot.protocolSlotSlug",
      message: "graft tray link expects a protocol slot slug",
    });
  }

  const { surgeryId, caseId, bookingId } = ctx.surgeryContext;
  if (
    isGraftTrayLinkEligible(ctx) &&
    !surgeryId?.trim() &&
    !caseId?.trim() &&
    !bookingId?.trim()
  ) {
    issues.push({
      field: "surgeryContext.surgeryId",
      message: "graft tray link expects surgeryId, caseId, or bookingId for SurgeryOS linkage",
    });
  }

  return { valid: issues.length === 0, issues };
}

export function mergeGraftTrayImageMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  patch: GraftTrayImageMetadataPatch
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? existingMetadata
      : {};
  return { ...base, ...patch };
}

export function buildGraftTrayLinkInsertRow(
  ctx: GraftTrayCaptureContext,
  resolved: {
    surgeryId: string | null;
    graftSessionId: string | null;
    linkId: string;
    capturedAt: string;
  }
): GraftTrayLinkInsertRow {
  const reviewReasons = deriveGraftTrayReviewReasons({
    reviewRequired: true,
    reconciliationEvidenceRequired: true,
    qualityNeedsReview: ctx.capture.qualityNeedsReview === true,
    missingProtocolSlot: !ctx.slot.protocolSlotSlug?.trim(),
  });

  const metadata = ctx.capture.metadata ?? {};
  const surgeryContextMeta =
    metadata.surgery_context && typeof metadata.surgery_context === "object"
      ? (metadata.surgery_context as Record<string, unknown>)
      : metadata.vie_surgery_context && typeof metadata.vie_surgery_context === "object"
        ? (metadata.vie_surgery_context as Record<string, unknown>)
        : {
            surgery_id: resolved.surgeryId,
            case_id: ctx.surgeryContext.caseId,
            booking_id: ctx.surgeryContext.bookingId,
            procedure_day_id: ctx.surgeryContext.procedureDayId,
          };

  const linkMetadata = buildGraftTrayLinkMetadata({
    captureSource: ctx.capture.captureSource,
    protocolSessionId: ctx.slot.protocolSessionId,
    surgeryContext: surgeryContextMeta,
  });

  const slotVariant = ctx.slot.slotVariant ?? resolveGraftTraySlotVariant(captureSignalsFromContext(ctx));

  return {
    tenant_id: ctx.tenantId,
    patient_id: ctx.patientId,
    image_id: ctx.imageId,
    surgery_case_id: ctx.surgeryContext.caseId?.trim() || null,
    surgery_id: resolved.surgeryId,
    booking_id: ctx.surgeryContext.bookingId?.trim() || null,
    graft_session_id: resolved.graftSessionId,
    graft_count_event_id: null,
    protocol_session_id: ctx.slot.protocolSessionId?.trim() || null,
    protocol_slot_slug: ctx.slot.protocolSlotSlug?.trim() || slotVariant || "graft_tray",
    captured_by_staff_id: ctx.surgeryContext.capturedByStaffId?.trim() || null,
    status: (ctx.capture.qualityNeedsReview ? "review_required" : "linked") as GraftTrayLinkStatus,
    review_required: true,
    mismatch_reason: null,
    metadata: {
      ...linkMetadata,
      slot_variant: slotVariant,
      review_reasons: reviewReasons,
    },
  };
}

export function buildGraftTrayImageMetadataPatch(
  ctx: GraftTrayCaptureContext,
  linkId: string
): GraftTrayImageMetadataPatch {
  const reviewReasons = deriveGraftTrayReviewReasons({
    reviewRequired: true,
    reconciliationEvidenceRequired: true,
    qualityNeedsReview: ctx.capture.qualityNeedsReview === true,
    missingProtocolSlot: !ctx.slot.protocolSlotSlug?.trim(),
  });
  const slotVariant = ctx.slot.slotVariant ?? resolveGraftTraySlotVariant(captureSignalsFromContext(ctx));

  return {
    graft_tray_link_id: linkId,
    graft_tray_review_reasons: reviewReasons,
    graft_tray_reconciliation_evidence: true,
    graft_tray_slot_variant: slotVariant,
  };
}

/** @deprecated Use parseGraftTrayCaptureContext — returns null when not a graft tray capture. */
export function parseGraftTrayLinkContext(
  input: FlatGraftTrayLinkInput
): GraftTrayCaptureContext | null {
  const ctx = parseGraftTrayCaptureContext(input);
  return isGraftTrayLinkEligible(ctx) ? ctx : null;
}