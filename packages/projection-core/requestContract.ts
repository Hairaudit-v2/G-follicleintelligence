/**
 * Versioned shared projection request contract.
 * Identity keys are UUIDs / checksums only — never patient names or mutable labels.
 */

export const SHARED_PROJECTION_REQUEST_CONTRACT_VERSION =
  "fi-shared-projection-request-v1" as const;

export const SHARED_PROJECTION_MODES = [
  "conservative",
  "planned",
  "optimistic_within_approved_range",
] as const;

export type SharedProjectionMode = (typeof SHARED_PROJECTION_MODES)[number];

export const SHARED_PROJECTION_REQUESTING_PRODUCTS = [
  "fios",
  "hairaudit",
  "patient_os",
] as const;

export type SharedProjectionRequestingProduct =
  (typeof SHARED_PROJECTION_REQUESTING_PRODUCTS)[number];

export const SHARED_PROJECTION_SOURCE_VIEWS = [
  "frontal",
  "left_profile",
  "right_profile",
  "top",
  "occipital",
  "other",
] as const;

export type SharedProjectionSourceView = (typeof SHARED_PROJECTION_SOURCE_VIEWS)[number];

export type SharedZoneGraftAllocation = {
  zoneKey: string;
  grafts: number;
  targetDensityPerCm2: number | null;
  deferred: boolean;
  unassessed: boolean;
  priority: string | null;
};

export type SharedHairCharacteristics = {
  calibreHint: string | null;
  curlTextureHint: string | null;
  colourToScalpContrastHint: string | null;
  hairsPerGraftAssumption: number | null;
};

export type SharedProjectionRequestV1 = {
  contractVersion: typeof SHARED_PROJECTION_REQUEST_CONTRACT_VERSION;
  tenantId: string;
  /** Opaque subject reference (foundation patient / global subject) — not a display name. */
  patientSubjectRef: string;
  fiosCaseId: string | null;
  hairauditCaseRef: string | null;
  approvedSurgicalPlanId: string;
  approvedSurgicalPlanVersion: number;
  approvedHairlineDesignId: string;
  approvedHairlineDesignVersion: number;
  sourceImageRef: string;
  sourceImageChecksum: string;
  sourceView: SharedProjectionSourceView;
  treatmentMaskRef: string;
  treatmentMaskChecksum: string;
  preservationMaskRef: string | null;
  preservationMaskChecksum: string | null;
  graftAllocationsByZone: SharedZoneGraftAllocation[];
  recipientSurfaceAreaCm2: number | null;
  hairCharacteristics: SharedHairCharacteristics;
  nativeHairContribution: string | null;
  projectionMode: SharedProjectionMode;
  clinicalAssumptions: Record<string, unknown>;
  requestedOutputWidth: number | null;
  requestedOutputHeight: number | null;
  requestingProduct: SharedProjectionRequestingProduct;
  requestingUserId: string | null;
  requestingCapability: string | null;
  correlationId: string;
  /** Pre-derived or null — service derives from canonical parts when null. */
  idempotencyKey: string | null;
  providerId: string;
  modelVersion: string;
  promptTemplateVersion: string;
  artifactType: "illustrative_projected_outcome";
};

export type SharedProjectionIdempotencyParts = {
  patientSubjectRef: string;
  planId: string;
  planVersion: number;
  hairlineDesignId: string;
  hairlineDesignVersion: number;
  sourceImageChecksum: string;
  maskChecksum: string;
  view: SharedProjectionSourceView;
  mode: SharedProjectionMode;
  providerId: string;
  modelVersion: string;
  promptTemplateVersion: string;
};

export function isSharedProjectionMode(value: unknown): value is SharedProjectionMode {
  return (
    typeof value === "string" &&
    (SHARED_PROJECTION_MODES as readonly string[]).includes(value)
  );
}

export function isSharedProjectionRequestingProduct(
  value: unknown
): value is SharedProjectionRequestingProduct {
  return (
    typeof value === "string" &&
    (SHARED_PROJECTION_REQUESTING_PRODUCTS as readonly string[]).includes(value)
  );
}
