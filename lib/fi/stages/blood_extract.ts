/**
 * blood_extract: reads blood-panel uploads and populates fi_signals_blood.
 * Deterministic, idempotent (replace semantics).
 *
 * STATUS: NOT IMPLEMENTED
 * -----------------------
 * Real PDF/CSV extraction logic has not been built yet. This stage returns
 * an empty marker set and does NOT write any rows to fi_signals_blood.
 *
 * Downstream stages (androgen_age_model, report_compose) handle an empty
 * marker array by omitting the hormonal_androgen scorecard section -- this
 * is an honest "no blood data analysed" result rather than fake placeholder
 * data that could be mistaken for a real clinical signal.
 *
 * When extraction is implemented, remove the early-return guard below and
 * replace it with actual parsing logic. The output type and DB schema are
 * already correct and require no changes.
 */
import type { StageContext, StageResult } from "./types";

export const BLOOD_UPLOAD_TYPES = ["blood_pdf", "blood_csv"] as const;
type BloodUploadType = (typeof BLOOD_UPLOAD_TYPES)[number];

export type BloodExtractInput = {
  uploads: Array<{
    id: string;
    type: string;
    filename: string;
    storage_path: string;
    mime_type: string | null;
  }>;
};

export type BloodMarker = {
  name: string;
  value: number | string | null;
  unit?: string;
  referenceRange?: string;
  flag?: "low" | "normal" | "high" | "critical";
};

export type BloodExtractOutput = {
  markers: BloodMarker[];
  confidence: Record<string, number | string>;
};

export async function runBloodExtract(
  _ctx: StageContext,
  input: BloodExtractInput,
  _dryRun?: boolean
): Promise<StageResult<BloodExtractOutput>> {
  const bloodUploads = input.uploads.filter((u) =>
    BLOOD_UPLOAD_TYPES.includes(u.type as BloodUploadType)
  );

  const output: BloodExtractOutput = {
    markers: [],
    confidence: { status: "not_implemented" },
  };

  const warning =
    bloodUploads.length > 0
      ? "Blood signal extraction is not yet implemented. " +
        String(bloodUploads.length) +
        " blood upload(s) were present but no markers were extracted. " +
        "No data was written to fi_signals_blood."
      : undefined;

  return { ok: true, data: output, warning };
}
