import type { HieHairLossReviewStatus } from "../hairLossClassification/types";

/**
 * Up-weights clinician-verified rows; down-weights rejected AI rows for velocity confidence.
 */
export function hairLossReviewStatusToConfidenceMultiplier(status: string): number {
  const s = status.trim().toLowerCase();
  if (s === "accepted") return 1.12;
  if (s === "corrected") return 1.22;
  if (s === "rejected") return 0.45;
  return 1;
}

export function isClinicianVerifiedReviewStatus(status: string): status is "accepted" | "corrected" {
  return status === "accepted" || status === "corrected";
}

export function describeReviewWeighting(points: Array<{ review_status: HieHairLossReviewStatus | string }>) {
  if (points.length === 0) {
    return { average_review_multiplier: 1, verified_point_fraction: 0 };
  }
  let sum = 0;
  let verified = 0;
  for (const p of points) {
    const m = hairLossReviewStatusToConfidenceMultiplier(String(p.review_status));
    sum += m;
    if (isClinicianVerifiedReviewStatus(String(p.review_status))) verified += 1;
  }
  return {
    average_review_multiplier: sum / points.length,
    verified_point_fraction: verified / points.length,
  };
}
