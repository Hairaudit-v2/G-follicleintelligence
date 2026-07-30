/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Errors and safe HTTP mapping.
 */

export type ProjectionErrorCode =
  | "missing_token_config"
  | "invalid_bearer"
  | "browser_session_denied"
  | "missing_hmac_headers"
  | "invalid_timestamp"
  | "timestamp_skew"
  | "signature_invalid"
  | "replay_rejected"
  | "case_header_mismatch"
  | "unsupported_schema_version"
  | "validation_failed"
  | "malformed_source_ref"
  | "unsafe_source_ref"
  | "invalid_projection_mode"
  | "missing_approved_plan_provenance"
  | "checksum_mismatch"
  | "idempotency_conflict"
  | "request_too_large"
  | "invalid_json"
  | "feature_disabled"
  | "hairaudit_channel_disabled"
  | "clinic_channel_disabled"
  | "provider_disabled"
  | "stub_blocked_in_production"
  | "tenant_mapping_missing"
  | "storage_not_configured"
  | "callback_not_configured"
  | "output_validation_failed"
  | "provider_failed"
  | "job_not_found"
  | "cross_case_denied";

export class ProjectionGatewayError extends Error {
  readonly code: ProjectionErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ProjectionErrorCode, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = "ProjectionGatewayError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function errorJson(err: ProjectionGatewayError, requestId?: string): Record<string, unknown> {
  return {
    ok: false,
    error: err.code,
    message: err.message,
    errorCode: err.code,
    ...(requestId ? { request_id: requestId } : {}),
  };
}
