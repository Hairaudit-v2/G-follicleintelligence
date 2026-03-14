/**
 * Claim-safe text blocks for report generation.
 * Report builder pulls only from these blocks.
 */

export const CLAIM_SAFE_BLOCKS = {
  disclaimer: `This report is for decision-support only. Findings are consistent with the data provided and do not constitute medical advice. Consult a qualified healthcare provider.`,

  risk_tier: {
    low: `Scores suggest lower relative risk. This may support a favorable baseline for ongoing management.`,
    medium: `Scores suggest moderate considerations. Further evaluation may be warranted.`,
    high: `Scores suggest elevated factors. Consultation with a specialist may be indicated.`,
  },

  section_interpretation: (sectionLabel: string, score: number) =>
    `The ${sectionLabel} domain score of ${score.toFixed(2)} is consistent with the data provided. This may indicate areas for consideration.`,

  general_caveat: `Findings are suggestive and should be interpreted in clinical context. Individual outcomes may vary.`,
} as const;
