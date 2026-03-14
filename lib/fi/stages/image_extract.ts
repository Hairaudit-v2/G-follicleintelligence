/**
 * image_extract: reads uploads, populates fi_signals_image.
 * Deterministic, idempotent (replace semantics).
 */
import type { StageContext, StageResult } from "./types";

const IMAGE_TYPES = [
  "scalp_preop_front",
  "scalp_sides_left",
  "scalp_sides_right",
  "scalp_crown",
  "donor_rear",
  "postop_day0",
] as const;
type ImageUploadType = (typeof IMAGE_TYPES)[number];

export type ImageExtractInput = {
  uploads: Array<{
    id: string;
    type: string;
    filename: string;
    storage_path: string;
    mime_type: string | null;
  }>;
  /** From tenant config feature_flags.enable_image_signals. Default true. */
  enableImageSignals?: boolean;
};

export type ImageSignalPayload = {
  filename: string;
  storage_path: string;
  signals: Record<string, unknown>;
};

export type ImageExtractOutput = ImageSignalPayload[];

export async function runImageExtract(
  ctx: StageContext,
  input: ImageExtractInput,
  dryRun?: boolean
): Promise<StageResult<ImageExtractOutput>> {
  const { tenantId, caseId, supabase } = ctx;
  const enableImageSignals = input.enableImageSignals !== false;

  const imageUploads = enableImageSignals
    ? input.uploads.filter((u) => IMAGE_TYPES.includes(u.type as ImageUploadType))
    : [];
  const outputs: ImageExtractOutput = imageUploads.map((u) => ({
    filename: u.filename,
    storage_path: u.storage_path,
    signals: {}, // TODO: run actual image analysis
  }));

  if (!dryRun) {
    await supabase
      .from("fi_signals_image")
      .delete()
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId);
    for (const p of outputs) {
      await supabase.from("fi_signals_image").insert({
        tenant_id: tenantId,
        case_id: caseId,
        payload: {
          filename: p.filename,
          storage_path: p.storage_path,
          signals: p.signals,
        },
        confidence: {},
      });
    }
  }

  return { ok: true, data: outputs };
}
