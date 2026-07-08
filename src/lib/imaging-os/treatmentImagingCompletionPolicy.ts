import {
  TREATMENT_PHOTOS_BLOCKED_MESSAGE,
  TREATMENT_PHOTOS_INCOMPLETE_WARNING,
  type TreatmentImagingCompletionState,
} from "./treatmentImagingProtocol";
import {
  parseTreatmentImagingClinicSettings,
  treatmentPhotosBlockCompletion,
  type TreatmentImagingClinicSettings,
} from "./treatmentImagingClinicSettings";

export type TreatmentImagingCompletionPolicyResult = {
  allowed: boolean;
  warning: string | null;
  blocked: boolean;
  blockedMessage: string | null;
};

export function evaluateTreatmentImagingCompletionPolicy(input: {
  applies: boolean;
  completion: TreatmentImagingCompletionState;
  clinicSettings: TreatmentImagingClinicSettings;
}): TreatmentImagingCompletionPolicyResult {
  if (!input.applies) {
    return { allowed: true, warning: null, blocked: false, blockedMessage: null };
  }
  if (input.completion.complete) {
    return { allowed: true, warning: null, blocked: false, blockedMessage: null };
  }
  const blocked = treatmentPhotosBlockCompletion(input.clinicSettings, false);
  return {
    allowed: !blocked,
    warning: blocked ? null : TREATMENT_PHOTOS_INCOMPLETE_WARNING,
    blocked,
    blockedMessage: blocked ? TREATMENT_PHOTOS_BLOCKED_MESSAGE : null,
  };
}

export function parseClinicSettingsFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): TreatmentImagingClinicSettings {
  return parseTreatmentImagingClinicSettings(metadata);
}
