/**
 * risk_score: applies tenant weights, computes final FI scorecard, stores payload_json.
 * Weights from fi_tenants.config_json via getTenantConfig.
 */
import type { StageContext, StageResult } from "./types";
import type { AndrogenAgeOutput } from "./androgen_age_model";
import type { FiScorecardV1 } from "../scorecard";
import { resolveScorecardWeights, computeOverallScore, tierFromScore } from "../scorecard";
import { getTenantConfig } from "../tenantConfig";

export type RiskScoreInput = {
  androgenOutput: AndrogenAgeOutput;
};

export type RiskScoreOutput = {
  scorecard: FiScorecardV1;
};

export async function runRiskScore(
  ctx: StageContext,
  input: RiskScoreInput,
  dryRun?: boolean
): Promise<StageResult<RiskScoreOutput>> {
  const { tenantId, caseId, modelRunId, supabase } = ctx;

  const { scorecard } = input.androgenOutput;
  const tenantConfig = await getTenantConfig(supabase, tenantId);
  const weights = resolveScorecardWeights(
    tenantConfig ? { scorecard_weights: tenantConfig.scorecard_weights ?? undefined } : null
  );
  scorecard.weights_applied = weights;
  scorecard.overall_score = computeOverallScore(scorecard.sections, weights);
  scorecard.risk_tier = tierFromScore(scorecard.overall_score);

  const explainability: Record<string, string[]> = {};
  for (const [id, section] of Object.entries(scorecard.sections)) {
    explainability[id] = [section.interpretation ?? `Score: ${section.score}`];
  }
  scorecard.explainability = explainability;

  const output: RiskScoreOutput = { scorecard };

  if (!dryRun) {
    const { data: existing } = await supabase
      .from("fi_scorecards")
      .select("id")
      .eq("model_run_id", modelRunId)
      .single();

    const payload = {
      tenant_id: tenantId,
      case_id: caseId,
      model_run_id: modelRunId,
      payload_json: scorecard,
      domain_scores: Object.fromEntries(
        Object.entries(scorecard.sections).map(([k, v]) => [k, v.score])
      ),
      overall_score: scorecard.overall_score,
      risk_tier: scorecard.risk_tier,
      explainability: scorecard.explainability,
    };

    if (existing) {
      await supabase.from("fi_scorecards").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("fi_scorecards").insert(payload);
    }
  }

  return { ok: true, data: output };
}
