import { z } from "zod";
import {
  HIE_DONOR_DENSITY_BANDS,
  HIE_DONOR_QUALITY_RATINGS,
  HIE_DONOR_REGIONS,
  HIE_DONOR_REVIEW_STATUSES,
  HIE_DONOR_RISK_LEVELS,
  HIE_EXTRACTION_CAUTION_LEVELS,
  HIE_LIFETIME_GRAFT_BUDGET_BANDS,
  HIE_SAFE_DONOR_CAPACITY_BANDS,
} from "./types";

const REG = HIE_DONOR_REGIONS as unknown as [string, ...string[]];
const QLT = HIE_DONOR_QUALITY_RATINGS as unknown as [string, ...string[]];
const DNS = HIE_DONOR_DENSITY_BANDS as unknown as [string, ...string[]];
const RSK = HIE_DONOR_RISK_LEVELS as unknown as [string, ...string[]];
const CAP = HIE_SAFE_DONOR_CAPACITY_BANDS as unknown as [string, ...string[]];
const BUD = HIE_LIFETIME_GRAFT_BUDGET_BANDS as unknown as [string, ...string[]];
const EXT = HIE_EXTRACTION_CAUTION_LEVELS as unknown as [string, ...string[]];
const REV = HIE_DONOR_REVIEW_STATUSES as unknown as [string, ...string[]];

export const donorAssessmentReviewBodySchema = z
  .object({
    adminKey: z.string().optional(),
    review_status: z.enum(REV),
    donor_region: z.enum(REG).optional(),
    donor_quality_rating: z.enum(QLT).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    estimated_density_band: z.enum(DNS).nullable().optional(),
    miniaturisation_risk: z.enum(RSK).nullable().optional(),
    retrograde_risk: z.enum(RSK).nullable().optional(),
    overharvesting_risk: z.enum(RSK).nullable().optional(),
    safe_donor_capacity_band: z.enum(CAP).nullable().optional(),
    lifetime_graft_budget_band: z.enum(BUD).nullable().optional(),
    extraction_caution_level: z.enum(EXT).nullable().optional(),
    clinical_observations: z.string().max(8000).nullable().optional(),
    ai_notes: z.string().max(8000).nullable().optional(),
  })
  .strict();

export type DonorAssessmentReviewBody = z.infer<typeof donorAssessmentReviewBodySchema>;
