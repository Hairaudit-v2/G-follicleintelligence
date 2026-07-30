/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Provider-neutral generation contract.
 */

import type { ParsedHairAuditProjectionRequest } from "./schema";
import type { ProjectionMode } from "./types";

export type ProjectionProviderGenerateInput = {
  jobId: string;
  mode: ProjectionMode;
  modelVersion: string;
  caseId: string;
  sourceImageId: string;
  sourceImageRef: string;
  approvedGraftPlanId: string;
  approvedGraftPlanVersion: number;
  approvedGraftPlanChecksum: string;
  approvedAnnotationIds: string[];
  constraints: unknown;
  deterministicSeed?: string | null;
  canonical: ParsedHairAuditProjectionRequest["canonical"];
  inputChecksum: string;
  abortSignal?: AbortSignal;
};

export type ProjectionProviderGenerateResult =
  | {
      ok: true;
      providerRequestId: string;
      providerResponseId: string;
      modelVersion: string;
      outputBytes: Buffer;
      mimeType: string;
      limitations: string[];
      planningAssumptions: string[];
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
      retryable: boolean;
      providerRequestId?: string | null;
      providerResponseId?: string | null;
    };

export type ProjectionProviderHealth = {
  healthy: boolean;
  detail: string;
  configured: boolean;
};

export interface PreSurgeryProjectionProvider {
  readonly name: string;
  readonly modelVersion: string;
  healthcheck(): Promise<ProjectionProviderHealth>;
  generateProjection(
    input: ProjectionProviderGenerateInput
  ): Promise<ProjectionProviderGenerateResult>;
  cancel?(providerRequestId: string): Promise<void>;
}
