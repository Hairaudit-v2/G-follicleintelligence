/** Derived triage flags consumed by insights, eligibility, and signal builders. */

export type TriageFlags = {
  manualReviewRecommended: boolean;
  bloodsLikelyNeeded: boolean;
  possibleIronRisk: boolean;
  possibleThyroidRisk: boolean;
  possibleHormonalPattern: boolean;
  possibleInflammatoryPattern: boolean;
  possibleAndrogenPattern: boolean;
  possibleStressTrigger: boolean;
  postpartumFlag: boolean;
};
