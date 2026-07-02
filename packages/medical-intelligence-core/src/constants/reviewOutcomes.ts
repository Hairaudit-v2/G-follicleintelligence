/** Review outcome values referenced by eligibility and signal builders. */

export const REVIEW_OUTCOME = {
  REVIEW_COMPLETE: "review_complete",
  AWAITING_PATIENT_DOCUMENTS: "awaiting_patient_documents",
  FOLLOW_UP_RECOMMENDED: "follow_up_recommended",
  STANDARD_PATHWAY: "standard_pathway",
  BLOODS_RECOMMENDED: "bloods_recommended",
  REFERRAL_RECOMMENDED: "referral_recommended",
  FOLLOW_UP_SCHEDULED: "follow_up_scheduled",
  OTHER: "other",
} as const;

export type ReviewOutcome = (typeof REVIEW_OUTCOME)[keyof typeof REVIEW_OUTCOME];
