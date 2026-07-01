/**
 * Imaging Core — session taxonomy metadata for unified ingest (Phase 1).
 */

export type ImagingSessionTaxonomy = {
  session_type: string;
  view: string | null;
  interval: string | null;
  protocol_version: string | null;
  capture_source: string;
};

export type BuildImagingSessionTaxonomyInput = {
  capture_source?: string | null;
  protocol_template_slug?: string | null;
  protocol_slot_slug?: string | null;
  follow_up_interval?: string | null;
  visit_type?: string | null;
  image_category?: string | null;
  upload_source?: string | null;
};

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function inferSessionType(input: BuildImagingSessionTaxonomyInput): string {
  const capture = normalizeKey(input.capture_source);
  const template = normalizeKey(input.protocol_template_slug);
  const uploadSource = normalizeKey(input.upload_source);

  if (capture === "surgery_os" || template === "surgery_day" || template === "post_op_review") {
    return "surgery_day";
  }
  if (
    capture === "follow_up_outcome" ||
    template === "follow_up_review" ||
    normalizeKey(input.follow_up_interval)
  ) {
    return "follow_up";
  }
  if (capture === "consultation_os" || template === "baseline_consultation" || template === "hair_loss_consultation") {
    return "consultation";
  }
  if (capture === "patient_portal") return "patient_portal";
  if (capture === "iiohr_academy" || uploadSource === "iiohr") return "iiohr_academy";
  if (uploadSource === "hairaudit" || capture === "hairaudit") return "audit";
  if (uploadSource === "hair_longevity") return "hli_intake";
  if (template === "hair_transplant_planning") return "planning";
  return "general_clinical";
}

function resolveProtocolVersion(
  input: BuildImagingSessionTaxonomyInput,
  sessionType: string
): string | null {
  const template = input.protocol_template_slug?.trim() || null;
  if (sessionType === "follow_up") {
    return template ?? "follow_up_review";
  }
  return template;
}

/** Build normalized session taxonomy block for fi_patient_images.metadata.imaging_session. */
export function buildImagingSessionTaxonomy(
  input: BuildImagingSessionTaxonomyInput
): ImagingSessionTaxonomy {
  const captureSource = normalizeKey(input.capture_source) || normalizeKey(input.upload_source) || "unknown";
  const sessionType = inferSessionType(input);
  return {
    session_type: sessionType,
    view: input.protocol_slot_slug?.trim() || input.image_category?.trim() || null,
    interval: input.follow_up_interval?.trim() || null,
    protocol_version: resolveProtocolVersion(input, sessionType),
    capture_source: captureSource,
  };
}