/**
 * image_extract: reads scalp/donor image uploads and populates fi_signals_image.
 * Deterministic, idempotent (replace semantics).
 *
 * STATUS: NOT IMPLEMENTED
 * -----------------------
 * Real image analysis (miniaturisation scoring, density mapping, etc.) has not
 * been built yet. This stage returns an empty output array and does NOT write
 * any rows to fi_signals_image.
 *
 * Previously the stage wrote rows with signals:{} -- empty objects that looked
 * like real signal records and caused downstream stages (androgen_age_model,
 * report_compose) to silently treat images as analysed. That behaviour has
 * been removed.
 *
 * Downstream stages already handle an empty ImageExtractOutput array
 * correctly: runAndrogenAgeModel() skips the image_miniaturization_density
 * scorecard section when imageSignals.length === 0.
 *
 * When extraction is implemented:
 *  1. Remove the early-return guard below.
 *  2. Add real analysis logic per IMAGE_UPLOAD_TYPES upload.
 *  3. Restore the idempotent delete + insert against fi_signals_image.
 *  4. The output type, DB schema, and caller in pipeline.ts require no changes.
 */
import type { StageContext, StageResult } from "./types";

export const IMAGE_UPLOAD_TYPES = [
  "scalp_preop_front",
  "scalp_sides_left",
  "scalp_sides_right",
  "scalp_crown",
  "donor_rear",
  "postop_day0",
] as const;
type ImageUploadType = (typeof IMAGE_UPLOAD_TYPES)[number];

export type ImageExtractInput = {
  uploads: Array<{
    id: string;
    type: string;
    filename: string;
    storage_path: string;
    mime_type: string | null;
  }>;
  enableImageSignals?: boolean;
};

export type ImageSignalPayload = {
  filename: string;
  storage_path: string;
  signals: Record<string, unknown>;
};

export type ImageExtractOutput = ImageSignalPayload[];

export async function runImageExtract(
  _ctx: StageContext,
  input: ImageExtractInput,
  _dryRun?: boolean
): Promise<StageResult<ImageExtractOutput>> {
  const enableImageSignals = input.enableImageSignals !== false;

  const imageUploads = enableImageSignals
    ? input.uploads.filter((u) => IMAGE_UPLOAD_TYPES.includes(u.type as ImageUploadType))
    : [];

  const warning =
    imageUploads.length > 0
      ? "Image signal extraction is not yet implemented. " +
        String(imageUploads.length) +
        " image upload(s) were present but no signals were extracted. " +
        "No data was written to fi_signals_image."
      : undefined;

  return { ok: true, data: [], warning };
}
