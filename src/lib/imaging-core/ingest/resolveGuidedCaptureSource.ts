/**
 * Imaging Core — derive explicit capture_source from protocol template (PR-4).
 */

import type { FiImageCaptureSource } from "@/src/lib/patientImages/fiImageAttributionTypes";

const SURGERY_PROTOCOL_TEMPLATES = new Set([
  "surgery_day",
  "post_op_review",
  "repair_surgery_review",
]);

const FOLLOW_UP_PROTOCOL_TEMPLATES = new Set(["follow_up_review"]);

const PRESERVED_EXPLICIT_SOURCES = new Set<FiImageCaptureSource>([
  "appointment_procedure",
  "appointment_procedure_admin_fallback",
  "patient_profile",
  "patient_slide_over",
  "profile_upload_form",
]);

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export type ResolveGuidedCaptureSourceInput = {
  protocolTemplateSlug: string;
  explicitCaptureSource?: string | null;
  /** FI ImagingOS workspace wizard vs VIE modal wizard. */
  guidedSurface?: "vie" | "imaging_os";
};

/**
 * Resolve the capture_source sent on patient image uploads from protocol context.
 * Preserves appointment/profile explicit sources; infers surgery_os and follow_up_outcome from templates.
 */
export function resolveGuidedCaptureSource(
  input: ResolveGuidedCaptureSourceInput
): FiImageCaptureSource {
  const template = normalizeKey(input.protocolTemplateSlug);
  const explicit = normalizeKey(input.explicitCaptureSource) as FiImageCaptureSource;

  if (explicit && PRESERVED_EXPLICIT_SOURCES.has(explicit)) {
    return explicit;
  }
  if (explicit === "surgery_os" || explicit === "follow_up_outcome") {
    return explicit;
  }

  if (SURGERY_PROTOCOL_TEMPLATES.has(template)) {
    return "surgery_os";
  }
  if (FOLLOW_UP_PROTOCOL_TEMPLATES.has(template)) {
    return "follow_up_outcome";
  }

  if (input.guidedSurface === "imaging_os") {
    if (explicit === "imaging_os_wizard") return explicit;
    return "imaging_os_wizard";
  }

  if (explicit === "vie_capture_wizard") {
    return explicit;
  }

  return "vie_capture_wizard";
}