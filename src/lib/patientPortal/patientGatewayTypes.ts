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
  "not_found",
  "payments_disabled",
  "invoice_not_payable",
  "amount_mismatch",
  "currency_mismatch",
  "messaging_disabled",
  "message_empty",
  "message_too_long",
  "message_rate_limited",
  "message_duplicate",
  "thread_closed",
  "invalid_device",
  "device_not_found",
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
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500;
  message: string;
};

export type PatientGatewayOk = {
  ok: true;
  context: PatientGatewayContext;
};

export type PatientGatewayResult = PatientGatewayOk | PatientGatewayDeny;

export type PatientGatewayMeClinic = {
  id: string;
  /** Tenant / brand display name (e.g. Evolved Hair). */
  name: string | null;
  /** Clinic / site location label (e.g. Perth). */
  locationName: string | null;
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
  | "upload_replay_denied"
  | "journey_read_success"
  | "journey_read_denied"
  | "appointments_list_success"
  | "appointments_list_denied"
  | "appointment_read_success"
  | "appointment_read_denied"
  | "appointment_ownership_denied"
  | "billing_summary_read_success"
  | "billing_summary_read_denied"
  | "invoices_list_success"
  | "invoices_list_denied"
  | "invoice_read_success"
  | "invoice_read_denied"
  | "invoice_ownership_denied"
  | "payment_session_created"
  | "payment_session_denied"
  | "payment_webhook_received"
  | "payment_webhook_verified"
  | "payment_webhook_rejected"
  | "payment_reconciled"
  | "payment_replay_ignored"
  | "payment_reconciliation_failed"
  | "message_threads_list_success"
  | "message_threads_list_denied"
  | "message_thread_read_success"
  | "message_thread_read_denied"
  | "message_ownership_denied"
  | "patient_message_sent"
  | "patient_message_send_denied"
  | "notification_preferences_read"
  | "notification_preferences_updated"
  | "notification_dispatch_requested"
  | "notification_dispatch_succeeded"
  | "notification_dispatch_failed"
  | "patient_device_registered"
  | "patient_device_refreshed"
  | "patient_device_disabled"
  | "patient_device_list"
  | "patient_notification_dispatch_requested"
  | "patient_notification_sent"
  | "patient_notification_failed"
  | "patient_notification_token_invalidated"
  | "consent_read_success"
  | "consent_recorded"
  | "consent_record_denied";
