/**
 * Visual Intelligence Engine — future capability contracts (Phase 1 stubs).
 *
 * These types define extension points for comparison, longitudinal tracking,
 * surgical documentation, and outcome intelligence without implementing AI yet.
 */

export const VIE_FUTURE_ENGINE_VERSION = "vie-future.v1" as const;

/** Side-by-side / temporal image comparison engine. */
export type VieComparisonEngineContract = {
  engine: "vie_comparison";
  version: typeof VIE_FUTURE_ENGINE_VERSION;
  /** Pair images by protocol slot across sessions. */
  match_strategy: "protocol_slot" | "anatomical_region" | "ai_alignment";
  status: "implemented";
};

/** Longitudinal hair progression tracking across follow-up protocols. */
export type VieLongitudinalTrackingContract = {
  engine: "vie_longitudinal";
  version: typeof VIE_FUTURE_ENGINE_VERSION;
  timepoint_sources: ("baseline_consultation" | "follow_up_review" | "post_op_review")[];
  status: "implemented";
};

/** Surgical documentation — links surgery_day + post_op_review into a case bundle. */
export type VieSurgicalDocumentationContract = {
  engine: "vie_surgical_documentation";
  version: typeof VIE_FUTURE_ENGINE_VERSION;
  bundle_protocols: ("surgery_day" | "post_op_review" | "repair_surgery_review")[];
  status: "not_implemented";
};

/** Outcome intelligence — evidence readiness from comparisons, alignment, and documentation. */
export type VieOutcomeIntelligenceContract = {
  engine: "vie_outcome_intelligence";
  version: typeof VIE_FUTURE_ENGINE_VERSION;
  inputs: ("comparison_engine" | "longitudinal_tracking" | "surgical_documentation")[];
  status: "implemented";
};

export type VieFutureArchitecture = {
  comparison_engine: VieComparisonEngineContract;
  longitudinal_tracking: VieLongitudinalTrackingContract;
  surgical_documentation: VieSurgicalDocumentationContract;
  outcome_intelligence: VieOutcomeIntelligenceContract;
};

export const VIE_FUTURE_ARCHITECTURE: VieFutureArchitecture = {
  comparison_engine: {
    engine: "vie_comparison",
    version: VIE_FUTURE_ENGINE_VERSION,
    match_strategy: "protocol_slot",
    status: "implemented",
  },
  longitudinal_tracking: {
    engine: "vie_longitudinal",
    version: VIE_FUTURE_ENGINE_VERSION,
    timepoint_sources: ["baseline_consultation", "follow_up_review", "post_op_review"],
    status: "implemented",
  },
  surgical_documentation: {
    engine: "vie_surgical_documentation",
    version: VIE_FUTURE_ENGINE_VERSION,
    bundle_protocols: ["surgery_day", "post_op_review", "repair_surgery_review"],
    status: "not_implemented",
  },
  outcome_intelligence: {
    engine: "vie_outcome_intelligence",
    version: VIE_FUTURE_ENGINE_VERSION,
    inputs: ["comparison_engine", "longitudinal_tracking", "surgical_documentation"],
    status: "implemented",
  },
};
