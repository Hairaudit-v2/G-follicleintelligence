export {
  CONSENT_CHANNELS,
  CONSENT_FORM_KEYS,
  CONSENT_FORM_KEY_SET,
  CONSENT_FORM_KEY_TITLES,
  CONSENT_INSTANCE_STATUSES,
  isConsentFormKey,
  type ConsentChannel,
  type ConsentFormKey,
  type ConsentInstanceRow,
  type ConsentInstanceStatus,
  type ConsentRequirementResolution,
  type ConsentTemplateRef,
  type PatientConsentStatusSummary,
  type PatientRequiredConsentsPanelData,
  type RequiredConsentPanelItem,
} from "./consentTypes";

export {
  computePatientConsentStatusSummary,
  planOutstandingConsentCreates,
  planOutstandingVersionSync,
  resolveRequiredConsentFormKeys,
  treatmentFormKeysFromBooking,
  type ConsentResolverBookingSignal,
  type ConsentResolverInput,
} from "./consentRequirementResolver";
