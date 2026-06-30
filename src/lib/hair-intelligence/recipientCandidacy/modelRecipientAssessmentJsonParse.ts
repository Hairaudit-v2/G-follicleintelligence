import { z } from "zod";
import {
  clampRecipientConfidence,
  normalizeHieRecipientQualityRating,
  normalizeHieRecipientRiskLevel,
  normalizeHieRecipientSurgicalTimingRisk,
} from "./enumValidation";
import type { RecipientAssessmentModelResult } from "./types";

const rawSchema = z.object({
  recipient_quality_rating: z.string(),
  confidence_score: z.number(),
  diffuse_thinning_risk: z.union([z.string(), z.null()]).optional(),
  shock_loss_risk: z.union([z.string(), z.null()]).optional(),
  density_expectation_risk: z.union([z.string(), z.null()]).optional(),
  medication_stabilisation_needed: z.boolean(),
  pathology_review_recommended: z.boolean(),
  surgical_timing_risk: z.union([z.string(), z.null()]).optional(),
  patient_expectation_risk: z.union([z.string(), z.null()]).optional(),
  documentation_gap_detected: z.boolean(),
  review_topics: z.array(z.unknown()),
  candidacy_summary: z.string(),
  ai_notes: z.string(),
});

export type RecipientModelJsonParseSuccess = { ok: true; data: RecipientAssessmentModelResult };
export type RecipientModelJsonParseFailure = { ok: false; error: string };

function sliceText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function normalizeTopics(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    out.push(t.slice(0, 500));
    if (out.length >= 40) break;
  }
  return out;
}

export function parseRecipientAssessmentModelJson(
  parsed: unknown
): RecipientModelJsonParseSuccess | RecipientModelJsonParseFailure {
  const zod = rawSchema.safeParse(parsed);
  if (!zod.success) {
    return { ok: false, error: zod.error.issues[0]?.message ?? "invalid json" };
  }
  const d = zod.data;
  const out: RecipientAssessmentModelResult = {
    recipient_quality_rating: normalizeHieRecipientQualityRating(d.recipient_quality_rating),
    confidence_score: clampRecipientConfidence(d.confidence_score),
    diffuse_thinning_risk: normalizeHieRecipientRiskLevel(d.diffuse_thinning_risk ?? null),
    shock_loss_risk: normalizeHieRecipientRiskLevel(d.shock_loss_risk ?? null),
    density_expectation_risk: normalizeHieRecipientRiskLevel(d.density_expectation_risk ?? null),
    medication_stabilisation_needed: Boolean(d.medication_stabilisation_needed),
    pathology_review_recommended: Boolean(d.pathology_review_recommended),
    surgical_timing_risk: normalizeHieRecipientSurgicalTimingRisk(d.surgical_timing_risk ?? null),
    patient_expectation_risk: normalizeHieRecipientRiskLevel(d.patient_expectation_risk ?? null),
    documentation_gap_detected: Boolean(d.documentation_gap_detected),
    review_topics: normalizeTopics(d.review_topics),
    candidacy_summary: sliceText(
      typeof d.candidacy_summary === "string" ? d.candidacy_summary : "",
      8000
    ),
    ai_notes: sliceText(typeof d.ai_notes === "string" ? d.ai_notes : "", 8000),
  };
  return { ok: true, data: out };
}
