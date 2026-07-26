/**
 * FI-PATIENT-APP-1B — Patient Gateway shared types (pure).
 */

export const PATIENT_GATEWAY_DENY_CODES = [
  "unauthenticated",
  "invalid_token",
  "unlinked",
  "ambiguous_mapping",
  "inactive_patient",
  "wrong_tenant",
  "ownership_denied",
  "staff_credential_rejected",
  "misconfigured",
  "imaging_disabled",
  "invalid_category",
  "invalid_mime",
  "file_too_large",
  "intent_invalid",
  "intent_expired",
  "intent_replay",
  "storage_missing",
  "path_mismatch",
  "consent_required",
] as const;

export type PatientGatewayDenyCode = (typeof PATIENT_GATEWAY_DENY_CODES)[number];

/** Patient statuses allowed to use the patient gateway. */
export const PATIENT_GATEWAY_ACTIVE_STATUSES = ["active"] as const;

export type PatientGatewayContext = {
  authUserId: string;
  patientId: string;
  tenantId: string;
  personId: string;
  patientStatus: string;
  clinicName: string | null;
};

export type PatientGatewayDeny = {
  ok: false;
  code: PatientGatewayDenyCode;
  status: 400 | 401 | 403 | 409 | 500;
  message: string;
};

export type PatientGatewayOk = {
  ok: true;
  context: PatientGatewayContext;
};

export type PatientGatewayResult = PatientGatewayOk | PatientGatewayDeny;

export type PatientGatewayMeClinic = {
  id: string;
  name: string | null;
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  };
};

export type PatientGatewayMeResponse = {
  ok: true;
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  clinic: PatientGatewayMeClinic;
};

export type PatientGatewayAuditAction =
  | "auth_ok"
  | "auth_denied"
  | "mapping_unresolved"
  | "mapping_ambiguous"
  | "wrong_tenant"
  | "ownership_denied"
  | "inactive_patient"
  | "staff_credential_rejected"
  | "me_ok"
  | "images_list_success"
  | "images_list_denied"
  | "upload_intent_created"
  | "upload_intent_denied"
  | "upload_completed"
  | "upload_completion_denied"
  | "upload_replay_denied";
