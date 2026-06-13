function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export type DonorAssessmentAnalyticsRow = {
  donor_quality_rating: string;
  confidence_score: number;
  miniaturisation_risk: string | null;
  retrograde_risk: string | null;
  overharvesting_risk: string | null;
  safe_donor_capacity_band: string | null;
  extraction_caution_level: string | null;
};

export type DonorAssessmentAnalyticsInput = DonorAssessmentAnalyticsRow[];

/**
 * Pure analytics over persisted donor assessment rows (in-memory; no I/O).
 */
export function donorQualityDistribution(rows: DonorAssessmentAnalyticsInput) {
  const m = new Map<string, number>();
  for (const r of rows) increment(m, r.donor_quality_rating || "unknown");
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([donor_quality_rating, count]) => ({ donor_quality_rating, count }));
}

export function donorAverageConfidence(rows: DonorAssessmentAnalyticsInput): number | null {
  const nums = rows.map((r) => r.confidence_score).filter((n) => Number.isFinite(n));
  return mean(nums);
}

export function donorRiskDistribution(rows: DonorAssessmentAnalyticsInput) {
  const mini = new Map<string, number>();
  const retro = new Map<string, number>();
  const over = new Map<string, number>();
  for (const r of rows) {
    increment(mini, r.miniaturisation_risk ?? "null");
    increment(retro, r.retrograde_risk ?? "null");
    increment(over, r.overharvesting_risk ?? "null");
  }
  return {
    miniaturisation: Object.fromEntries(mini),
    retrograde: Object.fromEntries(retro),
    overharvesting: Object.fromEntries(over),
  };
}

export function donorUnsafeOrAvoidExtractionCount(rows: DonorAssessmentAnalyticsInput): number {
  let n = 0;
  for (const r of rows) {
    if (r.donor_quality_rating === "unsafe" || r.extraction_caution_level === "avoid") n += 1;
  }
  return n;
}

/** Share of rows where donor quality is unknown (image-only uncertainty signal). */
export function donorUnknownAssessmentRate(rows: DonorAssessmentAnalyticsInput): number {
  if (rows.length === 0) return 0;
  const u = rows.filter((r) => r.donor_quality_rating === "unknown").length;
  return u / rows.length;
}

export function donorSafeCapacityBandDistribution(rows: DonorAssessmentAnalyticsInput) {
  const m = new Map<string, number>();
  for (const r of rows) increment(m, r.safe_donor_capacity_band ?? "null");
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([safe_donor_capacity_band, count]) => ({ safe_donor_capacity_band, count }));
}
