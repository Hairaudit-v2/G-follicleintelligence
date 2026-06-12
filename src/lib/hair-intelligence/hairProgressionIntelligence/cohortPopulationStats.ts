/**
 * Pure helpers for population / cohort velocity rollups (Stage 9B cohort intelligence).
 */

export type VelocityDistributionSummary = {
  n: number;
  mean: number | null;
  p25: number | null;
  p75: number | null;
};

function quantileSorted(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] == null) return sorted[base] ?? null;
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

/** Summarises a list of observed progression velocities (grades per year). */
export function summariseVelocityDistribution(gradesPerYear: number[]): VelocityDistributionSummary {
  const arr = gradesPerYear.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (arr.length === 0) return { n: 0, mean: null, p25: null, p75: null };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    n: arr.length,
    mean,
    p25: quantileSorted(arr, 0.25),
    p75: quantileSorted(arr, 0.75),
  };
}
