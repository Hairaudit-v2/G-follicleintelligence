import type { HliPhotoProtocolClinicalContext } from "./types";

/** Default template slug per clinical context (Stage 8B seeds). */
export const DEFAULT_PHOTO_PROTOCOL_TEMPLATE_BY_CONTEXT: Record<
  HliPhotoProtocolClinicalContext,
  string
> = {
  consultation: "consultation_standard",
  surgery_pre_op: "surgery_pre_op_standard",
  surgery_immediate_post_op: "immediate_post_op_standard",
  follow_up: "follow_up_standard",
  hairaudit_case: "hairaudit_case_standard",
  hli_intake: "hli_intake_standard",
  hli_progress: "follow_up_standard",
  trichoscopy: "hli_intake_standard",
  microscopic: "hli_intake_standard",
};
