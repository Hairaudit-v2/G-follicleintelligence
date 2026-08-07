/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Shared projection domain types.
 * Supports HairAudit service channel and native FiOS clinic channel (1B).
 */

export const HA_PROJECTION_REQUEST_SCHEMA_VERSION =
  "ha-imagingos-pre-surgery-projection-request-v1" as const;

export const HA_CANONICAL_SNAPSHOT_SCHEMA_VERSION =
  "ha-pre-surgery-canonical-projection-request-v1" as const;

export const PROJECTION_MODES = [
  "conservative",
  "planned",
  "optimistic_within_approved_range",
] as const;

export type ProjectionMode = (typeof PROJECTION_MODES)[number];

export type ProjectionSourceChannel = "hairaudit_service" | "fios_clinic";

export type ProjectionJobStatus =
  | "received"
  | "validated"
  | "queued"
  | "generating"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export type ClinicianReviewState =
  | "not_applicable"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "superseded";

export type PatientVisibilityEligibility = "ineligible" | "eligible_after_approval" | "shared";

export type ProviderStateReport =
  | "REAL_PROVIDER_CONNECTED"
  | "STUB_ONLY_NON_PRODUCTION"
  | "PROVIDER_DISABLED";

export type ProjectionProviderName = "stub" | "disabled" | "openai-gpt-image";

export type CanonicalProjectionGeometry = {
  hairlineAnnotationIds: string[];
  recipientZoneAnnotationIds: string[];
  deferredZones: string[];
  excludedZones: string[];
  zoneGraftTargets: Array<{ zone: string; grafts: number; priority: string }>;
};

export type CanonicalProjectionRequestSnapshot = {
  schemaVersion: typeof HA_CANONICAL_SNAPSHOT_SCHEMA_VERSION;
  caseId: string;
  sourceImageIds: string[];
  primarySourceImageId: string;
  imageRoles: Array<{
    imageId: string;
    assignedRole: string;
    orientationDegrees: number;
    mirrored: boolean;
  }>;
  approvedObservationIds: string[];
  approvedGraftPlanId: string;
  approvedGraftPlanVersion: number;
  approvedGraftPlanChecksum: string;
  projectionMode: ProjectionMode;
  geometry: CanonicalProjectionGeometry;
  providerId: string;
  modelVersion: string;
  safetyLabelVersion: string;
  generationPolicyVersion: string;
  engineVersion: string;
  sourceImageRefs: Array<{ imageId: string; storageRef: string }>;
  approvedAnnotationIds: string[];
};

/** Exact HairAudit outbound request body (nulls allowed where adapter sends them). */
export type HairAuditProjectionRequestBody = {
  schemaVersion: typeof HA_PROJECTION_REQUEST_SCHEMA_VERSION;
  idempotencyKey: string | null;
  inputChecksum: string | null;
  modelVersion: string;
  mode: ProjectionMode;
  caseId: string;
  sourceImageId: string;
  sourceImageRef: string;
  approvedGraftPlanId: string;
  approvedGraftPlanVersion: number;
  approvedGraftPlanChecksum: string;
  approvedAnnotationIds: string[];
  constraints: unknown;
  deterministicSeed?: string | null;
  canonical: CanonicalProjectionRequestSnapshot | null;
  /** Forward-compatible: HairAudit projection row id for async callbacks (not sent today). */
  projectionId?: string | null;
  externalProjectionId?: string | null;
};

export type ProjectionTenantProvenance = {
  sourceChannel: ProjectionSourceChannel;
  tenantId: string;
  clinicId: string;
  /** Internal FiOS refs when available (clinic channel / mapped). */
  patientId: string | null;
  caseId: string | null;
  procedureId: string | null;
  /** External HairAudit refs when applicable. */
  externalCaseId: string | null;
  externalProjectionId: string | null;
  externalOrgKey: string | null;
};

export type ProjectionSuccessResponse = {
  outputStorageRef: string;
  outputChecksum: string;
  providerRequestId?: string;
  providerResponseId?: string;
  modelVersion?: string;
  limitations?: string[];
  planningAssumptions?: string[];
};

export type ProjectionJobRecord = {
  id: string;
  sourceChannel: ProjectionSourceChannel;
  serviceSource: string;
  tenantId: string;
  clinicId: string;
  caseId: string;
  externalCaseId: string | null;
  externalProjectionId: string | null;
  patientId: string | null;
  procedureId: string | null;
  idempotencyKey: string;
  inputChecksum: string;
  schemaVersion: string;
  mode: ProjectionMode;
  modelVersion: string;
  status: ProjectionJobStatus;
  requestPayloadChecksum: string;
  providerName: string;
  providerRequestId: string | null;
  providerResponseId: string | null;
  outputStorageRef: string | null;
  outputChecksum: string | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  attemptCount: number;
  clinicianReviewState: ClinicianReviewState;
  patientVisibilityEligibility: PatientVisibilityEligibility;
  supersededByJobId: string | null;
  staleReason: string | null;
  immutableSnapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ProjectionHealthResponse = {
  status: "healthy" | "degraded" | "disabled";
  provider: string;
  providerConfigured: boolean;
  generationEnabled: boolean;
  storageConfigured: boolean;
  callbackConfigured: boolean;
  providerState: ProviderStateReport;
  hairauditChannelEnabled: boolean;
  clinicChannelEnabled: boolean;
  patientSharingEnabled: boolean;
};

export type ProjectionDomainEvent =
  | "request_received"
  | "authentication_failed"
  | "signature_failed"
  | "replay_rejected"
  | "validation_failed"
  | "idempotency_hit"
  | "idempotency_conflict"
  | "queued"
  | "provider_started"
  | "provider_completed"
  | "provider_failed"
  | "output_validation_failed"
  | "output_stored"
  | "callback_attempted"
  | "callback_succeeded"
  | "callback_failed"
  | "terminal_job_failure";
