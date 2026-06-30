import type { HieHairLossPatternType } from "../hairLossClassification/types";

export type HairProgressionAgeBand =
  | "under_25"
  | "25_35"
  | "36_45"
  | "46_55"
  | "56_plus"
  | "unknown";

export function dateOfBirthToAgeBand(
  isoDob: string | null | undefined,
  asOf: Date
): HairProgressionAgeBand {
  if (!isoDob || !isoDob.trim()) return "unknown";
  const d = new Date(isoDob.trim());
  if (Number.isNaN(d.getTime())) return "unknown";
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age -= 1;
  if (age < 25) return "under_25";
  if (age <= 35) return "25_35";
  if (age <= 45) return "36_45";
  if (age <= 55) return "46_55";
  return "56_plus";
}

/**
 * Stable, non-identifying cohort key for population / network rollups.
 */
export function buildHairProgressionCohortSignature(input: {
  pattern_type: HieHairLossPatternType | string;
  sex_classification: string | null | undefined;
  age_band: HairProgressionAgeBand;
  classification_system: string;
}): string {
  const sex = (input.sex_classification ?? "unknown").trim().toLowerCase() || "unknown";
  const pat = String(input.pattern_type ?? "unknown").trim() || "unknown";
  const sys = String(input.classification_system ?? "unknown").trim() || "unknown";
  return `${sys}|${pat}|${sex}|${input.age_band}`;
}
