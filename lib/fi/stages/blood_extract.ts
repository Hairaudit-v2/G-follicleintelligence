/**
 * blood_extract: reads uploads, populates fi_signals_blood.
 * Deterministic, idempotent (replace semantics).
 */
import type { StageContext, StageResult } from "./types";

const BLOOD_TYPES = ["blood_pdf", "blood_csv"] as const;

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

const BUCKET = process.env.FI_STORAGE_BUCKET_INTAKES || "fi-intakes";

export async function runBloodExtract(
  ctx: StageContext,
  input: BloodExtractInput,
  dryRun?: boolean
): Promise<StageResult<BloodExtractOutput>> {
  const { tenantId, caseId, supabase } = ctx;

  const bloodUploads = input.uploads.filter((u) => BLOOD_TYPES.includes(u.type));
  const markers: BloodMarker[] = [];

  for (const u of bloodUploads) {
    const { data } = await supabase.storage.from(BUCKET).download(u.storage_path);
    if (data) {
      // TODO: run actual PDF/CSV extraction; for now stub
      markers.push({ name: "placeholder", value: null, unit: "" });
    }
  }

  const output: BloodExtractOutput = {
    markers,
    confidence: { overall: markers.length > 0 ? "stub" : "none" },
  };

  if (!dryRun) {
    await supabase
      .from("fi_signals_blood")
      .delete()
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId);
    if (output.markers.length > 0) {
      await supabase.from("fi_signals_blood").insert({
        tenant_id: tenantId,
        case_id: caseId,
        payload: { markers: output.markers },
        confidence: output.confidence,
      });
    }
  }

  return { ok: true, data: output };
}
