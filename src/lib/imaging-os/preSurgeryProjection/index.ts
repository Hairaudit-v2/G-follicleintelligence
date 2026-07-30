/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Focused public exports for routes + 1B.
 * Do not re-export from imaging-os catch-all barrel.
 */

export {
  HA_PROJECTION_REQUEST_SCHEMA_VERSION,
  HA_CANONICAL_SNAPSHOT_SCHEMA_VERSION,
  PROJECTION_MODES,
  type ProjectionSourceChannel,
  type ProjectionJobStatus,
  type ProviderStateReport,
  type ProjectionSuccessResponse,
  type ProjectionHealthResponse,
} from "./types";

export {
  parseHairAuditProjectionRequest,
  hairAuditProjectionRequestSchema,
  MAX_PROJECTION_REQUEST_BYTES,
} from "./schema";

export {
  signHairAuditProjectionRequest,
  signHairAuditProjectionCallback,
  verifyHairAuditProjectionCallbackSignature,
  buildHairAuditProjectionRequestMaterial,
  sha256Hex,
} from "./hmac";

export {
  canTransitionProjectionJob,
  evaluateApprovalEligibility,
  evaluatePatientSharingEligibility,
  applySupersession,
} from "./domain.server";
