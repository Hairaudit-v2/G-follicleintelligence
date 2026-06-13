function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export type RecipientCandidacyAnalyticsRow = {
  recipient_quality_rating: string;
  medication_stabilisation_needed: boolean;
  pathology_review_recommended: boolean;
  documentation_gap_detected: boolean;
};

export type RecipientCandidacyAnalyticsInput = RecipientCandidacyAnalyticsRow[];

/** Distribution of persisted `recipient_quality_rating` values. */
export function recipientCandidacyQualityDistribution(rows: RecipientCandidacyAnalyticsInput) {
  const m = new Map<string, number>();
  for (const r of rows) increment(m, r.recipient_quality_rating || "unknown");
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([recipient_quality_rating, count]) => ({ recipient_quality_rating, count }));
}

export function recipientMedicationStabilisationRecommendationRate(rows: RecipientCandidacyAnalyticsInput): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.medication_stabilisation_needed).length;
  return n / rows.length;
}

export function recipientPathologyReviewRecommendationRate(rows: RecipientCandidacyAnalyticsInput): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.pathology_review_recommended).length;
  return n / rows.length;
}

export function recipientUnsuitableRate(rows: RecipientCandidacyAnalyticsInput): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.recipient_quality_rating === "unsuitable").length;
  return n / rows.length;
}

export function recipientDocumentationGapRate(rows: RecipientCandidacyAnalyticsInput): number {
  if (rows.length === 0) return 0;
  const n = rows.filter((r) => r.documentation_gap_detected).length;
  return n / rows.length;
}
