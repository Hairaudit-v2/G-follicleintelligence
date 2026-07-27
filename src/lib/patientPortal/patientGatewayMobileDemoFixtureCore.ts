/**
 * FI-PATIENT-APP-2A.1 — synthetic patient-gateway mobile demo fixture (pure metadata keys).
 * Creates/links a throwaway portal auth user → one active fi_patients row.
 * Does not modify golden SMOKETEST patient ids.
 */
export const PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_KEY = "e2e_patient_gateway_mobile_fixture_v1" as const;
export const PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_FLAG = "e2e_patient_gateway_mobile_fixture" as const;
/** Marks synthetic fixture bookings for FI-PATIENT-APP-2C device acceptance. */
export const PATIENT_GATEWAY_MOBILE_DEMO_BOOKING_FLAG =
  "e2e_patient_gateway_mobile_booking_fixture" as const;

export const PATIENT_GATEWAY_MOBILE_DEMO_EMAIL_DEFAULT =
  "e2e-patient-gateway-mobile@fi-demo.example" as const;
