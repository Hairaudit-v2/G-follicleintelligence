/**
 * ImagingOS — shared medical image intelligence engine (Phase IM-1 foundation + IM-2 ingestion).
 *
 * Pure contracts and stub evaluators. Consumers: HairAudit internal endpoint,
 * FI OS clinic uploads, HLI, IIOHR (future phases).
 */

export * from "./categories";
export * from "./classification";
export * from "./intake";
export * from "./pipeline";
export * from "./progression";
export * from "./protocol";
export * from "./outcomes";
export * from "./comparison";
export * from "./measurement";
export * from "./surgical";
export * from "./quality";
export * from "./qualityRules";
export * from "./summary";
export * from "./aiVision";
export * from "./types";

export { buildFiOsPatientImageIngestionRequest } from "./adapters/fiOsPatientImageAdapter";
export type { FiOsPatientImageAdapterInput } from "./adapters/fiOsPatientImageAdapter";
export { buildHliImageIngestionRequest } from "./adapters/hliImageAdapter";
export type { HliImageAdapterInput } from "./adapters/hliImageAdapter";
export { evaluateHairAuditCaseImageProtocol } from "./adapters/hairAuditCaseProtocolAdapter";
export { evaluateHairAuditSurgicalOutcomeReadiness } from "./adapters/hairAuditSurgicalOutcomeAdapter";
export type { HairAuditSurgicalOutcomeImageInput } from "./adapters/hairAuditSurgicalOutcomeAdapter";
export { evaluateHairAuditOutcomeMeasurement } from "./adapters/hairAuditOutcomeMeasurementAdapter";
export type { HairAuditOutcomeMeasurementImageInput } from "./adapters/hairAuditOutcomeMeasurementAdapter";
export { evaluateHairAuditVisualComparison } from "./adapters/hairAuditComparisonAdapter";
export type { HairAuditComparisonImageInput } from "./adapters/hairAuditComparisonAdapter";
export { buildHairAuditMeasurementStubs } from "./adapters/hairAuditMeasurementAdapter";
export type { HairAuditMeasurementInput } from "./adapters/hairAuditMeasurementAdapter";
export { buildHairAuditImagingSummary } from "./adapters/hairAuditSummaryAdapter";
export type {
  HairAuditImagingSummaryContract,
  HairAuditSummaryAdapterInput,
} from "./adapters/hairAuditSummaryAdapter";
export { buildHairAuditAiVisionReadiness } from "./adapters/hairAuditAiVisionAdapter";
export type { HairAuditAiVisionReadinessInput } from "./adapters/hairAuditAiVisionAdapter";

import type { ClassifyImageCategoryStubInput } from "./classification";
import { classifyImageCategoryStub } from "./classification";
import type { BuildImagingIntakeInput } from "./intake";
import { buildImagingIntakeRecord } from "./intake";
import { evaluateImageProtocolStub } from "./protocol";
import type { ImageQualityStubInput } from "./quality";
import { evaluateImageQualityStub } from "./quality";
import type { ImagingOsAnalysisSnapshot } from "./types";

/** Run the IM-1 stub pipeline: intake validation → quality → protocol → classification. */
export function runImagingOsStubPipeline(
  intakeInput: BuildImagingIntakeInput,
  classifyInput: Omit<ClassifyImageCategoryStubInput, "external_category"> & {
    external_category?: string;
  } = {}
): { ok: true; snapshot: ImagingOsAnalysisSnapshot } | { ok: false; error: string; field?: string } {
  const intakeResult = buildImagingIntakeRecord(intakeInput);
  if (!intakeResult.ok) return intakeResult;

  const externalCategory =
    classifyInput.external_category?.trim() ||
    intakeResult.intake.external_category?.trim() ||
    "other";

  const quality = evaluateImageQualityStub({
    content_type: intakeResult.intake.content_type,
    file_size_bytes: intakeResult.intake.file_size_bytes,
  } satisfies ImageQualityStubInput);

  const protocol = evaluateImageProtocolStub();
  const classification = classifyImageCategoryStub({
    external_category: externalCategory,
    legacy_upload_type:
      classifyInput.legacy_upload_type ?? intakeResult.intake.legacy_upload_type ?? null,
    idempotency_key: classifyInput.idempotency_key ?? intakeResult.intake.idempotency_key,
  });

  return {
    ok: true,
    snapshot: {
      intake: intakeResult.intake,
      quality,
      protocol,
      classification,
    },
  };
}
