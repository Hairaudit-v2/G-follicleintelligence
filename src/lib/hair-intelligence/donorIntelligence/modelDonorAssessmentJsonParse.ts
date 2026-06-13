import { z } from "zod";
import {
  clampDonorConfidence,
  normalizeHieDonorDensityBand,
  normalizeHieDonorQualityRating,
  normalizeHieDonorRegion,
  normalizeHieExtractionCautionLevel,
  normalizeHieLifetimeGraftBudgetBand,
  normalizeHieDonorRiskLevel,
  normalizeHieSafeDonorCapacityBand,
} from "./enumValidation";
import type { DonorAssessmentModelResult } from "./types";

const rawSchema = z.object({
  donor_region: z.string(),
  donor_quality_rating: z.string(),
  confidence_score: z.number(),
  estimated_density_band: z.union([z.string(), z.null()]).optional(),
  miniaturisation_risk: z.union([z.string(), z.null()]).optional(),
  retrograde_risk: z.union([z.string(), z.null()]).optional(),
  overharvesting_risk: z.union([z.string(), z.null()]).optional(),
  safe_donor_capacity_band: z.union([z.string(), z.null()]).optional(),
  lifetime_graft_budget_band: z.union([z.string(), z.null()]).optional(),
  extraction_caution_level: z.union([z.string(), z.null()]).optional(),
  clinical_observations: z.string(),
  ai_notes: z.string(),
});

export type DonorModelJsonParseSuccess = { ok: true; data: DonorAssessmentModelResult };
export type DonorModelJsonParseFailure = { ok: false; error: string };

function sliceText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

export function parseDonorAssessmentModelJson(parsed: unknown): DonorModelJsonParseSuccess | DonorModelJsonParseFailure {
  const zod = rawSchema.safeParse(parsed);
  if (!zod.success) {
    return { ok: false, error: zod.error.issues[0]?.message ?? "invalid json" };
  }
  const d = zod.data;
  const out: DonorAssessmentModelResult = {
    donor_region: normalizeHieDonorRegion(d.donor_region),
    donor_quality_rating: normalizeHieDonorQualityRating(d.donor_quality_rating),
    confidence_score: clampDonorConfidence(d.confidence_score),
    estimated_density_band: normalizeHieDonorDensityBand(d.estimated_density_band ?? null),
    miniaturisation_risk: normalizeHieDonorRiskLevel(d.miniaturisation_risk ?? null),
    retrograde_risk: normalizeHieDonorRiskLevel(d.retrograde_risk ?? null),
    overharvesting_risk: normalizeHieDonorRiskLevel(d.overharvesting_risk ?? null),
    safe_donor_capacity_band: normalizeHieSafeDonorCapacityBand(d.safe_donor_capacity_band ?? null),
    lifetime_graft_budget_band: normalizeHieLifetimeGraftBudgetBand(d.lifetime_graft_budget_band ?? null),
    extraction_caution_level: normalizeHieExtractionCautionLevel(d.extraction_caution_level ?? null),
    clinical_observations: sliceText(typeof d.clinical_observations === "string" ? d.clinical_observations : "", 8000),
    ai_notes: sliceText(typeof d.ai_notes === "string" ? d.ai_notes : "", 8000),
  };
  return { ok: true, data: out };
}
