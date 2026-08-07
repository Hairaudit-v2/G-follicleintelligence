/**
 * External HairAudit illustrative outcome display policy for FiOS.
 * Never imports as FiOS-approved. Requires verified subject mapping.
 */

export type ExternalHairAuditProjectionBrief = {
  hairauditProjectionId: string;
  hairauditCaseId: string;
  providerId: string;
  modelVersion: string;
  status: string;
  artifactType: string;
  outputChecksum: string;
  sourceChecksum: string;
  widthPx: number | null;
  heightPx: number | null;
  byteSize: number | null;
  patientSharingEnabled: boolean;
  fiosSubjectMappingVerified: boolean;
};

/**
 * HA asset 2791b827… inspection snapshot (read-only audit). Live status was rejected for seam.
 * FiOS mapping to case 83de37d6… was NOT verified — keep isolated.
 */
export const HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION = {
  id: "2791b827-d63c-4136-ae0c-f48de228800b",
  caseId: "83de37d6-5548-4efa-afe9-9ceeb34a226d",
  providerId: "openai-gpt-image",
  modelVersion: "gpt-image-2",
  artifactType: "illustrative_projected_outcome",
  liveStatusAtInspection: "rejected",
  rejectionReason:
    "facial_or_scalp_distortion: horizontal seam from unaligned OpenAI composite",
  outputChecksum: "7cef5d6132022b49ea0e2e655da6efd2e5d189ef87f8dff2c0f3f82a357f577f",
  sourceChecksum: "0451b327f402de78e3d3648fa5338b0530d5f49dd7d5a0182f545f4bef764441",
  maskChecksum: "fde4f691a1bbf8a969180b88ca849ef4010a814c5b6fbaa9c458e4395e375aa7",
  hairlineDesignId: "3af857db-596b-4c0d-8dc7-eb3ce3f892a6",
  hairlineGateBound: true,
  recipientZoneAnnotationsClinicianDrawn: false,
  byteSize: 743044,
  widthPx: 1799,
  heightPx: 2400,
  mimeType: "image/jpeg",
  outcomeValidationPass: true,
  outOfMaskMeanDelta: 0.786,
  faceBandMeanDelta: 0.609,
  backgroundBandMeanDelta: 0.601,
  fiosSubjectMappingVerified: false,
  displayAsAwaitingFiosReviewAllowed: false,
  /** 1C seam investigation — retain immutable; do not approve or share. */
  seamAtMaskBoundary: true,
  reviewerDecision: "rejected",
  likelyRootCause:
    "aspect/composite seam at upper scalp — mask feathering + letterbox restore contributed; prompt v3 + soft composite applied in shared provider",
  regressionFixturePolicy: "deidentify_or_synthetic_equivalent_only",
} as const;

export function canDisplayExternalProjectionInFios(
  brief: Pick<ExternalHairAuditProjectionBrief, "fiosSubjectMappingVerified" | "artifactType">
): boolean {
  return (
    brief.fiosSubjectMappingVerified &&
    brief.artifactType === "illustrative_projected_outcome"
  );
}

export function externalProjectionDisplayLabel(input: {
  fiosSubjectMappingVerified: boolean;
}): string {
  if (!input.fiosSubjectMappingVerified) {
    return "HairAudit projection remains isolated — FiOS subject mapping not verified.";
  }
  return "External projection awaiting FiOS clinical review";
}
