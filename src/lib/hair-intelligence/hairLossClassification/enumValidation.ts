import {
  HIE_CLASSIFICATION_SYSTEMS,
  HIE_HAIR_LOSS_PATTERN_TYPES,
  HIE_HAIR_LOSS_REVIEW_STATUSES,
  HIE_HAIR_LOSS_SOURCE_SYSTEMS,
  HIE_LUDWIG_GRADES,
  HIE_NORWOOD_GRADES,
  HIE_OLSEN_GRADES,
  HIE_SEX_CLASSIFICATIONS,
  HIE_SINCLAIR_GRADES,
  type HieHairLossClassificationSystem,
  type HieHairLossPatternType,
  type HieHairLossReviewStatus,
  type HieHairLossSourceSystem,
  type HieSexClassification,
} from "./types";

const SRC = new Set<string>(HIE_HAIR_LOSS_SOURCE_SYSTEMS);
const SYS = new Set<string>(HIE_CLASSIFICATION_SYSTEMS);
const PAT = new Set<string>(HIE_HAIR_LOSS_PATTERN_TYPES);
const REV = new Set<string>(HIE_HAIR_LOSS_REVIEW_STATUSES);
const SEX = new Set<string>(HIE_SEX_CLASSIFICATIONS);
const NW = new Set<string>(HIE_NORWOOD_GRADES);
const LD = new Set<string>(HIE_LUDWIG_GRADES);
const SN = new Set<string>(HIE_SINCLAIR_GRADES);
const OL = new Set<string>(HIE_OLSEN_GRADES);

export function isHieHairLossSourceSystem(v: unknown): v is HieHairLossSourceSystem {
  return typeof v === "string" && SRC.has(v);
}

export function normalizeHieHairLossSourceSystem(v: unknown): HieHairLossSourceSystem {
  return isHieHairLossSourceSystem(v) ? v : "fi_os";
}

export function isHieHairLossClassificationSystem(v: unknown): v is HieHairLossClassificationSystem {
  return typeof v === "string" && SYS.has(v);
}

export function normalizeHieHairLossClassificationSystem(v: unknown): HieHairLossClassificationSystem {
  return isHieHairLossClassificationSystem(v) ? v : "custom";
}

export function isHieHairLossPatternType(v: unknown): v is HieHairLossPatternType {
  return typeof v === "string" && PAT.has(v);
}

export function normalizeHieHairLossPatternType(v: unknown): HieHairLossPatternType {
  return isHieHairLossPatternType(v) ? v : "unknown";
}

export function isHieHairLossReviewStatus(v: unknown): v is HieHairLossReviewStatus {
  return typeof v === "string" && REV.has(v);
}

export function normalizeHieHairLossReviewStatus(v: unknown): HieHairLossReviewStatus {
  return isHieHairLossReviewStatus(v) ? v : "pending";
}

export function isHieSexClassification(v: unknown): v is HieSexClassification {
  return typeof v === "string" && SEX.has(v);
}

export function normalizeHieSexClassification(v: unknown): HieSexClassification {
  return isHieSexClassification(v) ? v : "unknown";
}

export function clampHairLossConfidence(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function clampHairLossSeverityScore(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 0 || n > 10) return null;
  return n;
}

function normaliseGradeString(raw: string): string {
  const t = raw.trim();
  if (!t) return "unknown";
  const tl = t.toLowerCase();
  if (tl === "iii vertex" || tl === "iiiv" || tl === "iii-v" || tl === "iiivertex") return "III Vertex";
  return t;
}

function normaliseRomanScaleGrade(system: HieHairLossClassificationSystem, g: string): string {
  if (system !== "norwood" && system !== "ludwig" && system !== "sinclair") return g;
  const tl = g.trim().toLowerCase();
  if (tl === "iii vertex") return "III Vertex";
  if (/^(i|ii|iii|iv|v|vi|vii)$/.test(tl)) return g.trim().toUpperCase();
  return g;
}

/**
 * Validates classification_grade against the declared classification_system.
 * Unknown / mismatched values coerced to "unknown" except custom allows short free text.
 */
export function normalizeClassificationGradeForSystem(
  system: HieHairLossClassificationSystem,
  grade: unknown
): string {
  if (grade === null || grade === undefined) return "unknown";
  const g0 = normaliseGradeString(String(grade));
  const g = normaliseRomanScaleGrade(system, g0);
  if (system === "norwood") return NW.has(g) ? g : "unknown";
  if (system === "ludwig") return LD.has(g) ? g : "unknown";
  if (system === "sinclair") return SN.has(g) ? g : "unknown";
  if (system === "olsen") {
    const lower = g.toLowerCase();
    if (OL.has(lower)) return lower;
    return "unknown";
  }
  if (system === "custom") {
    return g.length > 32 ? g.slice(0, 32) : g;
  }
  return "unknown";
}
