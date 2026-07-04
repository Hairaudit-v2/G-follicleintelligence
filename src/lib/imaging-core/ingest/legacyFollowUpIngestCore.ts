/**
 * Legacy follow-up ingest routing helpers (FI-IMAGING-LEGACY-FOLLOWUP-ROUTING-1).
 * Pure — no I/O.
 */

import type { FiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionTypes";
import type {
  IngestContextValidationResult,
  LegacyFollowUpIngestContext,
} from "./patientImageIngestContextTypes";

export const LEGACY_FOLLOW_UP_INGEST_CAPTURE_SOURCES = [
  "follow_up_outcome",
  "legacy_follow_up",
  "follow_up_encounter",
] as const;

export type LegacyFollowUpIngestCaptureSource =
  (typeof LEGACY_FOLLOW_UP_INGEST_CAPTURE_SOURCES)[number];

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isLegacyFollowUpIngestCaptureSource(
  source: string | null | undefined
): source is LegacyFollowUpIngestCaptureSource {
  const normalized = normalizeKey(source);
  return (LEGACY_FOLLOW_UP_INGEST_CAPTURE_SOURCES as readonly string[]).includes(normalized);
}

export function isLegacyFollowUpIngestContext(input: {
  capture_source?: string | null;
  protocol_template_slug?: string | null;
}): boolean {
  const captureSource = normalizeKey(input.capture_source);
  if (isLegacyFollowUpIngestCaptureSource(captureSource)) {
    return true;
  }
  if (
    (captureSource === "imaging_os_wizard" || captureSource === "vie_capture_wizard") &&
    normalizeKey(input.protocol_template_slug) === "follow_up_review"
  ) {
    return true;
  }
  return false;
}

/** Metadata capture_source written by the follow-up outcome adapter. */
export function resolveLegacyFollowUpMetadataCaptureSource(
  captureSource: FiImageCaptureSource | string | null | undefined
): LegacyFollowUpIngestCaptureSource {
  const normalized = normalizeKey(captureSource);
  if (isLegacyFollowUpIngestCaptureSource(normalized)) {
    return normalized;
  }
  return "follow_up_outcome";
}

export function extractFollowUpEncounterId(
  metadata?: Record<string, unknown> | null
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const direct = metadata.follow_up_encounter_id;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const progress = metadata.progress;
  if (progress && typeof progress === "object" && !Array.isArray(progress)) {
    const nested = (progress as Record<string, unknown>).follow_up_encounter_id;
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
  }
  const imagingSession = metadata.imaging_session;
  if (imagingSession && typeof imagingSession === "object" && !Array.isArray(imagingSession)) {
    const nested = (imagingSession as Record<string, unknown>).follow_up_encounter_id;
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
  }
  return null;
}

export function validateLegacyFollowUpIngestContext(
  ctx: LegacyFollowUpIngestContext
): IngestContextValidationResult {
  const issues: IngestContextValidationResult["issues"] = [];
  const captureSource = normalizeKey(ctx.capture_source);

  if (captureSource === "legacy_follow_up" || captureSource === "follow_up_encounter") {
    const encounterId =
      ctx.follow_up_encounter_id?.trim() || extractFollowUpEncounterId(ctx.metadata);
    if (!encounterId) {
      issues.push({
        field: "follow_up_encounter_id",
        message:
          "legacy follow-up ingest expects follow_up_encounter_id when linking to encounter records",
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Legacy follow-up captures must not create consultation dependencies. */
export function legacyFollowUpRejectsConsultationLinkage(
  consultationId: string | null | undefined
): boolean {
  return !String(consultationId ?? "").trim();
}