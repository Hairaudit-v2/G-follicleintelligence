/**
 * Provider-neutral boundary — FiOS / HairAudit adapt real generators behind this.
 * Do not copy OpenAI SDK trees into product apps; implement adapters against this contract.
 */

import type { ProjectionArtifactType } from "./artifactTypes";
import type { SharedProjectionFailureCategory } from "./failureCategories";
import type { SharedProjectionRequestV1 } from "./requestContract";
import type { SharedTechnicalValidationResults } from "./responseContract";

export type SharedProjectionProviderHealth = {
  healthy: boolean;
  configured: boolean;
  detail: string;
  /** True only when a real photoreal edit provider is connected and allowed. */
  realProviderConnected: boolean;
};

export type SharedProjectionProviderGenerateSuccess = {
  ok: true;
  providerGenerationId: string;
  modelVersion: string;
  promptTemplateVersion: string;
  outputBytes: Uint8Array;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  outputChecksum: string;
  technicalValidation: SharedTechnicalValidationResults;
  limitations: string[];
  planningAssumptions: string[];
};

export type SharedProjectionProviderGenerateFailure = {
  ok: false;
  failureCategory: SharedProjectionFailureCategory;
  message: string;
  retryable: boolean;
  providerGenerationId?: string | null;
};

export type SharedProjectionProviderGenerateResult =
  | SharedProjectionProviderGenerateSuccess
  | SharedProjectionProviderGenerateFailure;

/**
 * Shared imaging capability contract.
 * Photoreal adapters must use source-image edit (not from-scratch generation).
 * Overlay/stub adapters must refuse illustrative_projected_outcome.
 */
export interface SharedProjectionProvider {
  readonly providerId: string;
  readonly supportedArtifactTypes: readonly ProjectionArtifactType[];
  healthcheck(): Promise<SharedProjectionProviderHealth>;
  generate(
    request: SharedProjectionRequestV1,
    deps: {
      loadSourceBytes: (ref: string) => Promise<Uint8Array>;
      loadMaskBytes: (ref: string) => Promise<Uint8Array>;
      abortSignal?: AbortSignal;
    }
  ): Promise<SharedProjectionProviderGenerateResult>;
}

/**
 * Inventory classification for extracting HairAudit capability (not copying).
 * Living document for 1B foundation — update when HA modules are physically relocated.
 */
export const HAIRAUDIT_EXTRACT_INVENTORY = [
  {
    component: "openaiGptImageProvider.ts",
    classification: "shared_provider_infrastructure",
    notes:
      "1C: extracted to src/lib/imaging-os/sharedProjection/openai/openaiGptImageProvider.ts behind SharedProjectionProvider. HA file deprecated; prefer imagingos consumer.",
  },
  {
    component: "openaiGptImageStorage.server.ts",
    classification: "shared_provider_infrastructure",
    notes: "1C: extracted to openaiGptImageStorage.server.ts in sharedProjection/openai.",
  },
  {
    component: "treatmentMask.ts",
    classification: "shared_provider_infrastructure",
    notes: "1C: extracted (FiOS zone polygons + hairline curve).",
  },
  {
    component: "maskContainmentComposite.ts",
    classification: "shared_provider_infrastructure",
    notes: "1C: extracted with soft boundary feathering for seam repair.",
  },
  {
    component: "openaiEditPrompt.ts",
    classification: "shared_provider_infrastructure",
    notes: "1C: extracted as fi-openai-projected-outcome-prompt-v3 with seam constraints.",
  },
  {
    component: "openaiEditGeometry.ts",
    classification: "shared_provider_infrastructure",
    notes: "1C: extracted — aspect-fit pad/unpad unchanged.",
  },
  {
    component: "outcomeValidation.ts",
    classification: "reusable_validation_library",
    notes: "1C: extracted + seam/halo/exposure detectors; never auto-approves.",
  },
  {
    component: "assetValidation.ts / outputValidation.ts",
    classification: "reusable_validation_library",
    notes: "MIME/size/storage gates — shared.",
  },
  {
    component: "artifactTypes.ts",
    classification: "shared_provider_infrastructure",
    notes: "Extracted into @follicle/projection-core.",
  },
  {
    component: "hairlineApprovalGate.ts",
    classification: "hairaudit_specific_domain_logic",
    notes: "HA gate; FiOS has its own hairline SoR gate.",
  },
  {
    component: "approval.ts / patientVisibility.ts / patientConsent.ts",
    classification: "product_specific_ui_workflow",
    notes: "Remain in HairAudit — never move into shared service.",
  },
  {
    component: "localIllustrativeProvider.ts",
    classification: "shared_provider_infrastructure",
    notes: "Overlay-only; must never emit illustrative_projected_outcome.",
  },
  {
    component: "imagingOsProvider.ts",
    classification: "hairaudit_specific_domain_logic",
    notes: "HA HTTP client to ImagingOS — keep as consumer adapter.",
  },
  {
    component: "service.ts / stateMachine.ts / preflight.ts",
    classification: "hairaudit_specific_domain_logic",
    notes: "HA orchestration; FiOS clinic channel stays separate with shared contracts.",
  },
] as const;

export type HairAuditExtractClassification =
  (typeof HAIRAUDIT_EXTRACT_INVENTORY)[number]["classification"];
