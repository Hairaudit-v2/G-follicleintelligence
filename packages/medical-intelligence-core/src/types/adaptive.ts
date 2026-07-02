import type { AdaptiveDerivedSummary } from "../types/questionnaire";

export type AdaptiveRescoreChangedField =
  | "schema_version"
  | "primary_pathway"
  | "secondary_pathways"
  | "red_flags"
  | "clinician_attention_flags";

export type AdaptiveRescoreComparison = {
  stored_schema_version: string | null;
  current_schema_version: string;
  stored_primary_pathway: string | null;
  current_primary_pathway: string;
  stored_secondary_pathways: string[];
  current_secondary_pathways: string[];
  stored_red_flags: string[];
  current_red_flags: string[];
  stored_clinician_attention_flags: string[];
  current_clinician_attention_flags: string[];
  changed: boolean;
  changed_fields: AdaptiveRescoreChangedField[];
  summary_note: string;
};

export type AdaptiveSuggestionCategory =
  | "image_request"
  | "document_request"
  | "review_priority"
  | "pattern_caution"
  | "clinician_followup";

export type AdaptiveSuggestionId =
  | "request_center_part_images"
  | "prioritise_direct_scalp_review"
  | "review_recent_bloodwork_availability"
  | "mixed_pattern_caution"
  | "confirm_traction_history"
  | "confirm_androgen_exposure_chronology"
  | "confirm_postpartum_timing";

export type AdaptiveClinicianSuggestion = {
  id: AdaptiveSuggestionId;
  category: AdaptiveSuggestionCategory;
  message: string;
};

export type { AdaptiveDerivedSummary };
