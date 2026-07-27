/**
 * Pure helpers for patient gateway photography consent status.
 */

export type PatientGatewayConsentStatus = {
  ok: true;
  required: boolean;
  satisfied: boolean;
};

export function buildPatientGatewayConsentStatus(input: {
  required: boolean;
  satisfied: boolean;
}): PatientGatewayConsentStatus {
  return {
    ok: true,
    required: Boolean(input.required),
    // If consent is not required, treat as satisfied for client simplicity.
    satisfied: input.required ? Boolean(input.satisfied) : true,
  };
}
