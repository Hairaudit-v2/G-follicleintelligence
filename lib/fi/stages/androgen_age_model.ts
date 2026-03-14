/**
 * androgen_age_model: computes model outputs per FI_SCORECARD sections.
 * Deterministic, idempotent (replace by model_run_id).
 */
import type { StageContext, StageResult } from "./types";
import type { BloodExtractOutput } from "./blood_extract";
import type { ImageExtractOutput } from "./image_extract";
import type { FiScorecardSectionId, FiScorecardSectionScore, FiScorecardV1 } from "../scorecard";
import { FI_SCORECARD_SECTIONS, createEmptyScorecardV1 } from "../scorecard";

export type AndrogenAgeInput = {
  bloodSignals: BloodExtractOutput;
  imageSignals: ImageExtractOutput;
  intake: { dob?: string; sex?: string };
  /** From tenant config feature_flags.enable_progression_model. Default true. */
  enableProgressionModel?: boolean;
};

export type AndrogenAgeOutput = {
  scorecard: FiScorecardV1;
};

export async function runAndrogenAgeModel(
  ctx: StageContext,
  input: AndrogenAgeInput,
  dryRun?: boolean
): Promise<StageResult<AndrogenAgeOutput>> {
  const { tenantId, caseId, modelRunId, supabase } = ctx;

  const scorecard = createEmptyScorecardV1();

  const sectionScores: Partial<Record<FiScorecardSectionId, FiScorecardSectionScore>> = {};
  if (input.bloodSignals.markers.length > 0) {
    sectionScores.hormonal_androgen = { score: 0.5, interpretation: "Stub from blood markers" };
  }
  if (input.imageSignals.length > 0) {
    sectionScores.image_miniaturization_density = {
      score: 0.3,
      interpretation: "Stub from image signals",
    };
  }
  if (input.enableProgressionModel === false) {
    sectionScores.progression_timeline = {
      score: 0,
      interpretation: "Progression model disabled by tenant.",
    };
  }

  for (const id of FI_SCORECARD_SECTIONS) {
    if (sectionScores[id]) {
      scorecard.sections[id] = sectionScores[id]!;
    }
  }

  const output: AndrogenAgeOutput = { scorecard };

  if (!dryRun) {
    await supabase.from("fi_scorecards").delete().eq("model_run_id", modelRunId);
    await supabase.from("fi_scorecards").insert({
      tenant_id: tenantId,
      case_id: caseId,
      model_run_id: modelRunId,
      payload_json: scorecard,
      domain_scores: Object.fromEntries(
        FI_SCORECARD_SECTIONS.map((id) => [id, scorecard.sections[id]?.score ?? 0])
      ),
      explainability: {},
    });
  }

  return { ok: true, data: output };
}
