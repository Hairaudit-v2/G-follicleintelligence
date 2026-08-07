/**
 * Canonical shared projection response — never auto-approved or patient-shareable.
 */

import type { ProjectionArtifactType } from "./artifactTypes";
import type { SharedProjectionFailureCategory } from "./failureCategories";
import type { SharedProjectionLifecycleState } from "./lifecycle";

export const SHARED_PROJECTION_RESPONSE_CONTRACT_VERSION =
  "fi-shared-projection-response-v1" as const;

export type SharedTechnicalValidationResults = {
  mimeOk: boolean;
  dimensionsOk: boolean;
  byteSizeOk: boolean;
  storageObjectExists: boolean;
  checksumOk: boolean;
  sourceOutcomeAligned: boolean | null;
  faceBandMeanDelta: number | null;
  outOfMaskMeanDelta: number | null;
  outOfMaskMaxDelta: number | null;
  outOfMaskChangedFraction: number | null;
  backgroundBandMeanDelta: number | null;
  overallPass: boolean;
};

export type SharedProjectionInputProvenance = {
  surgicalPlanId: string;
  surgicalPlanVersion: number;
  hairlineDesignId: string;
  hairlineDesignVersion: number;
  sourceImageRef: string;
  sourceImageChecksum: string;
  treatmentMaskChecksum: string;
  preservationMaskChecksum: string | null;
};

export type SharedProjectionSuccessResponseV1 = {
  contractVersion: typeof SHARED_PROJECTION_RESPONSE_CONTRACT_VERSION;
  sharedGenerationId: string;
  lifecycleStatus: SharedProjectionLifecycleState;
  artifactType: ProjectionArtifactType;
  providerId: string;
  modelVersion: string;
  providerGenerationId: string | null;
  promptTemplateVersion: string;
  inputProvenance: SharedProjectionInputProvenance;
  outputStorageRef: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  byteSize: number;
  outputChecksum: string;
  technicalValidation: SharedTechnicalValidationResults;
  warnings: string[];
  /** Always false from the shared service — products own clinical approval. */
  clinicallyApproved: false;
  /** Always false from the shared service — products own patient sharing. */
  patientShareable: false;
  createdAt: string;
  updatedAt: string;
};

export type SharedProjectionFailureResponseV1 = {
  contractVersion: typeof SHARED_PROJECTION_RESPONSE_CONTRACT_VERSION;
  sharedGenerationId: string | null;
  lifecycleStatus: SharedProjectionLifecycleState | null;
  failureCategory: SharedProjectionFailureCategory;
  patientSafeMessage: string;
  warnings: string[];
  clinicallyApproved: false;
  patientShareable: false;
  createdAt: string;
};

export type SharedProjectionResponseV1 =
  | ({ ok: true } & SharedProjectionSuccessResponseV1)
  | ({ ok: false } & SharedProjectionFailureResponseV1);
