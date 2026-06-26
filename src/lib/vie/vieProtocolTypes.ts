/**
 * Visual Intelligence Engine (VIE) — Phase 1 protocol contract.
 *
 * Architecture-first: slot definitions, capture guidance, and completeness scoring.
 * AI vision hooks are stubbed; real inference plugs in later without schema churn.
 */

export const VIE_ENGINE_VERSION = "vie.v1" as const;

export const VIE_PROTOCOL_SLUGS = [
  "baseline_consultation",
  "full_clinical_head_series",
  "hair_transplant_planning",
  "surgery_day",
  "post_op_review",
  "follow_up_review",
  "repair_surgery_review",
] as const;

export type VieProtocolSlug = (typeof VIE_PROTOCOL_SLUGS)[number];

export type VieSlotTier = "primary" | "addon" | "optional";

/** UI grouping for the protocol picker dialog. */
export type VieProtocolPickerCategory =
  | "initial_consult"
  | "full_clinical_head_series"
  | "surgery_day"
  | "follow_up"
  | "repair_review";

export const VIE_PROTOCOL_PICKER_GROUPS: ReadonlyArray<{
  category: VieProtocolPickerCategory;
  label: string;
  hint: string;
}> = [
  {
    category: "initial_consult",
    label: "Initial consult",
    hint: "Six standard views — fast baseline for new patients and Patient Twin seeding.",
  },
  {
    category: "full_clinical_head_series",
    label: "Full clinical head series",
    hint: "Ten wide and close-up views for comprehensive clinical documentation.",
  },
  {
    category: "surgery_day",
    label: "Surgery day documentation",
    hint: "Pre-op through immediate post-op operative evidence capture.",
  },
  {
    category: "follow_up",
    label: "Follow-up review",
    hint: "Interval outcome views matched to baseline framing.",
  },
  {
    category: "repair_review",
    label: "Repair review",
    hint: "Corrective procedure documentation and outcome assessment.",
  },
];

export type VieSurgeryPhase =
  | "pre_op"
  | "design"
  | "extraction"
  | "graft_handling"
  | "implantation"
  | "immediate_post_op";

export const VIE_SURGERY_PHASE_GROUPS: ReadonlyArray<{ phase: VieSurgeryPhase; label: string }> = [
  { phase: "pre_op", label: "Pre-op" },
  { phase: "design", label: "Design" },
  { phase: "extraction", label: "Extraction" },
  { phase: "graft_handling", label: "Graft handling" },
  { phase: "implantation", label: "Implantation" },
  { phase: "immediate_post_op", label: "Immediate post-op" },
];

export type VieCaptureFraming = "overview" | "close_up";

export type VieCaptureGuideKind =
  | "front_hairline"
  | "front"
  | "front_close"
  | "left_side"
  | "left_side_close"
  | "right_side"
  | "right_side_close"
  | "top"
  | "top_close"
  | "crown"
  | "crown_close"
  | "donor"
  | "donor_close"
  | "left_temple"
  | "right_temple"
  | "top_down"
  | "donor_zone"
  | "recipient_zone"
  | "surgical_field"
  | "graft_tray"
  | "healing_progress"
  | "repair_zone";

export type VieProtocolSlotDef = {
  slug: string;
  label: string;
  required: boolean;
  /** Primary protocol views vs required add-ons (e.g. donor) vs optional extras. */
  slot_tier: VieSlotTier;
  /** Anatomical region for imaging library attribution. */
  suggested_region: string;
  /** Short clinical instruction shown during capture. */
  instruction: string;
  /** Visual overlay key for capture UI silhouette / framing guide. */
  capture_guide: VieCaptureGuideKind;
  /** Recommended camera distance (e.g. arm's length vs close-up). */
  capture_distance_hint: string;
  /** Overview vs close-up framing. */
  framing: VieCaptureFraming;
  /** When in the visit workflow this view is typically captured. */
  suggested_timing?: string;
  /** Operative phase — surgery day protocol only. */
  surgery_phase?: VieSurgeryPhase;
};

export type VieProtocolDef = {
  slug: VieProtocolSlug;
  name: string;
  description: string;
  picker_category: VieProtocolPickerCategory;
  imaging_library_axis: "consultation" | "surgery" | "follow_up" | "general_clinical";
  slots: VieProtocolSlotDef[];
};

export type VieSlotCompletionStatus = "missing" | "captured" | "skipped";

export type VieProtocolCompleteness = {
  protocol_slug: VieProtocolSlug;
  protocol_name: string;
  required_total: number;
  required_complete: number;
  optional_total: number;
  optional_complete: number;
  percent: number;
  complete: boolean;
  display: string;
  slots: VieProtocolSlotStatus[];
};

export type VieProtocolSlotStatus = {
  slug: string;
  label: string;
  required: boolean;
  slot_tier: VieSlotTier;
  status: VieSlotCompletionStatus;
  patient_image_id: string | null;
};

export type VieImagingDomainCompleteness = {
  label: string;
  required_total: number;
  required_complete: number;
  percent: number;
  complete: boolean;
  display: string;
};

export type VieSurgeryPhaseCompleteness = {
  phase: VieSurgeryPhase;
  label: string;
  required_total: number;
  required_complete: number;
  percent: number;
  complete: boolean;
  display: string;
};

export type VieLatestCaptureQuality = {
  quality_score: number;
  quality_band: "excellent" | "acceptable" | "retake_recommended";
  protocol_template_slug: string;
  protocol_slot_slug: string;
  captured_at: string;
  clinically_usable: boolean;
  acceptance_status: VieCaptureAcceptanceStatus;
};

export type VieCaptureAcceptanceStatus = "pending" | "accepted" | "replaced" | "superseded";

export type VieClinicalUsabilityStatus = "usable" | "warning" | "unusable";

export type VieClinicalUsability = {
  status: VieClinicalUsabilityStatus;
  clinically_usable: boolean;
  warnings: string[];
  retake_recommendation: string | null;
};

export type VieCaptureReviewDecision = {
  allowed: boolean;
  requires_override: boolean;
  reason: string | null;
};

export type VieCapturePolicySnapshot = {
  allow_quality_override: boolean;
  minimum_capture_quality_score: number;
  block_clinically_unusable_images: boolean;
};

export type ViePatientImagingCompleteness = {
  engine_version: typeof VIE_ENGINE_VERSION;
  /** Primary headline score — baseline consultation when present, else best active protocol. */
  headline: VieProtocolCompleteness;
  protocols: VieProtocolCompleteness[];
  consultation: VieImagingDomainCompleteness;
  full_head_series: VieImagingDomainCompleteness;
  surgical_documentation: VieImagingDomainCompleteness;
  donor_documentation: VieImagingDomainCompleteness;
  /** Per-phase breakdown for surgery day operative documentation. */
  surgery_phase_groups: VieSurgeryPhaseCompleteness[];
  latest_capture_quality: VieLatestCaptureQuality | null;
  active_session_id: string | null;
  active_protocol_slug: VieProtocolSlug | null;
};

/** Instant intelligence result (Phase 1 stubs — no AI vision yet). */
export type VieInstantIntelligenceResult = {
  engine_version: typeof VIE_ENGINE_VERSION;
  pipeline_version: string;
  patient_image_id: string;
  protocol_template_slug: string;
  protocol_slot_slug: string;
  classification: {
    status: "pending_ai" | "stub_match";
    expected_slot: string;
    expected_region: string;
    message: string;
  };
  angle_verification: {
    status: "pending_ai" | "stub_pass";
    expected_guide: VieCaptureGuideKind;
    message: string;
  };
  focus_verification: {
    status: "pending_ai" | "heuristic_pass" | "heuristic_fail";
    blur_score: number | null;
    message: string;
  };
  lighting_verification: {
    status: "pending_ai" | "heuristic_pass" | "heuristic_fail";
    exposure_score: number | null;
    message: string;
  };
  quality_score: number;
  quality_band: "excellent" | "acceptable" | "retake_recommended";
  clinical_usability: VieClinicalUsability;
  acceptance_status: VieCaptureAcceptanceStatus;
  intelligence_id?: string;
  protocol_completion: {
    required_complete: number;
    required_total: number;
    percent: number;
    complete: boolean;
  };
};

/** API payload returned to capture wizard after upload + intelligence run. */
export type VieCaptureReviewPayload = VieInstantIntelligenceResult & {
  review: VieCaptureReviewDecision;
  policy: VieCapturePolicySnapshot;
};
