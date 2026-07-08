/**
 * Clinic-level settings for treatment imaging (FI-TREATMENT-IMAGING-PROTOCOL-1).
 */

export const TREATMENT_IMAGING_CLINIC_SETTINGS_KEY = "imaging" as const;

export type TreatmentImagingClinicSettings = {
  /** When true, booking completion is blocked until required treatment views are captured. */
  require_treatment_photos_before_completion: boolean;
};

const DEFAULTS: TreatmentImagingClinicSettings = {
  require_treatment_photos_before_completion: false,
};

export function parseTreatmentImagingClinicSettings(
  clinicSettingsMetadata: Record<string, unknown> | null | undefined
): TreatmentImagingClinicSettings {
  const root = clinicSettingsMetadata?.[TREATMENT_IMAGING_CLINIC_SETTINGS_KEY];
  if (!root || typeof root !== "object" || Array.isArray(root)) return { ...DEFAULTS };
  const imaging = root as Record<string, unknown>;
  return {
    require_treatment_photos_before_completion:
      imaging.require_treatment_photos_before_completion === true,
  };
}

export function treatmentPhotosBlockCompletion(
  settings: TreatmentImagingClinicSettings,
  photosComplete: boolean
): boolean {
  return settings.require_treatment_photos_before_completion && !photosComplete;
}
