import {
  HIE_DONOR_DENSITY_BANDS,
  HIE_DONOR_QUALITY_RATINGS,
  HIE_DONOR_REGIONS,
  HIE_DONOR_REVIEW_STATUSES,
  HIE_DONOR_RISK_LEVELS,
  HIE_EXTRACTION_CAUTION_LEVELS,
  HIE_LIFETIME_GRAFT_BUDGET_BANDS,
  HIE_SAFE_DONOR_CAPACITY_BANDS,
  type HieDonorDensityBand,
  type HieDonorQualityRating,
  type HieDonorRegion,
  type HieDonorReviewStatus,
  type HieDonorRiskLevel,
  type HieExtractionCautionLevel,
  type HieLifetimeGraftBudgetBand,
  type HieSafeDonorCapacityBand,
} from "./types";

const REG = new Set<string>(HIE_DONOR_REGIONS);
const QLT = new Set<string>(HIE_DONOR_QUALITY_RATINGS);
const DNS = new Set<string>(HIE_DONOR_DENSITY_BANDS);
const RSK = new Set<string>(HIE_DONOR_RISK_LEVELS);
const CAP = new Set<string>(HIE_SAFE_DONOR_CAPACITY_BANDS);
const BUD = new Set<string>(HIE_LIFETIME_GRAFT_BUDGET_BANDS);
const EXT = new Set<string>(HIE_EXTRACTION_CAUTION_LEVELS);
const REV = new Set<string>(HIE_DONOR_REVIEW_STATUSES);

export function normalizeHieDonorRegion(v: unknown): HieDonorRegion {
  const s = typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, "_") : "";
  if (REG.has(s)) return s as HieDonorRegion;
  return "unknown";
}

export function normalizeHieDonorQualityRating(v: unknown): HieDonorQualityRating {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (QLT.has(s)) return s as HieDonorQualityRating;
  return "unknown";
}

export function normalizeHieDonorDensityBand(v: unknown): HieDonorDensityBand | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (DNS.has(s)) return s as HieDonorDensityBand;
  return "unknown";
}

export function normalizeHieDonorRiskLevel(v: unknown): HieDonorRiskLevel | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (RSK.has(s)) return s as HieDonorRiskLevel;
  return "unknown";
}

export function normalizeHieSafeDonorCapacityBand(v: unknown): HieSafeDonorCapacityBand | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (CAP.has(s)) return s as HieSafeDonorCapacityBand;
  return "unknown";
}

export function normalizeHieLifetimeGraftBudgetBand(v: unknown): HieLifetimeGraftBudgetBand | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (BUD.has(s)) return s as HieLifetimeGraftBudgetBand;
  return "unknown";
}

export function normalizeHieExtractionCautionLevel(v: unknown): HieExtractionCautionLevel | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (EXT.has(s)) return s as HieExtractionCautionLevel;
  return "unknown";
}

export function normalizeHieDonorReviewStatus(v: unknown): HieDonorReviewStatus {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (REV.has(s)) return s as HieDonorReviewStatus;
  return "pending";
}

export function clampDonorConfidence(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
