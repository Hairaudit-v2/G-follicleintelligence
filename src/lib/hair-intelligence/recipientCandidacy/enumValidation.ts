import {
  HIE_RECIPIENT_QUALITY_RATINGS,
  HIE_RECIPIENT_REVIEW_STATUSES,
  HIE_RECIPIENT_RISK_LEVELS,
  HIE_RECIPIENT_SURGICAL_TIMING_RISKS,
  type HieRecipientQualityRating,
  type HieRecipientReviewStatus,
  type HieRecipientRiskLevel,
  type HieRecipientSurgicalTimingRisk,
} from "./types";

const QLT = new Set<string>(HIE_RECIPIENT_QUALITY_RATINGS);
const RSK = new Set<string>(HIE_RECIPIENT_RISK_LEVELS);
const STG = new Set<string>(HIE_RECIPIENT_SURGICAL_TIMING_RISKS);
const REV = new Set<string>(HIE_RECIPIENT_REVIEW_STATUSES);

export function clampRecipientConfidence(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function normalizeHieRecipientQualityRating(v: unknown): HieRecipientQualityRating {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (QLT.has(s)) return s as HieRecipientQualityRating;
  return "unknown";
}

export function normalizeHieRecipientRiskLevel(v: unknown): HieRecipientRiskLevel | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (RSK.has(s)) return s as HieRecipientRiskLevel;
  return "unknown";
}

export function normalizeHieRecipientSurgicalTimingRisk(v: unknown): HieRecipientSurgicalTimingRisk | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s || s === "null") return null;
  if (STG.has(s)) return s as HieRecipientSurgicalTimingRisk;
  return "unknown";
}

export function normalizeHieRecipientReviewStatus(v: unknown): HieRecipientReviewStatus {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (REV.has(s)) return s as HieRecipientReviewStatus;
  return "pending";
}
