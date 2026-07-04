/**
 * ImagingOS — shared medical image intelligence engine (Phase IM-1 foundation + IM-2 ingestion).
 *
 * @deprecated Prefer focused entry points to reduce barrel coupling:
 * - `@/src/lib/imaging-os/ai` — AI analysis kinds / job vocabulary
 * - `@/src/lib/imaging-os/capture` — capture_source normalization
 * - `@/src/lib/imaging-os/review` — clinical review queue filters
 * - `@/src/lib/imaging-os/graft-tray` — graft tray bridge helpers
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
export * from "./imageQualityCore";
export * from "./imageQualityPolicy";
export * from "./imageQualityMetadata";
export * from "./clinicalImageAnalysisCore";
export * from "./scalpRegionEnforcement";
export * from "./imagingStaffReviewCore";
export * from "./imagingJobReadOnlySummaries";
export * from "./imagingClinicalIntelligenceSurfacing";
export * from "./protocolCatalogResolverCore";
export * from "./imagingDeepLinksCore";
export * from "./imagingOutcomeSignalsCore";
export * from "./patientSafeImagingExportCore";
export * from "./protocolCaptureMetadataCore";
export * from "./imagingClinicalReviewQueueFilters";
export * from "./imagingReviewAssignmentCore";
export * from "./imagingReviewerDirectoryCore";
export * from "./imagingNorwoodSignalCore";
export * from "./patientSafeImagingExportMapperCore";
export * from "./patientVisualSummaryReportTypes";
export * from "./patientVisualSummaryApprovalCore";
export * from "./patientVisualSummaryReportCore";
export * from "./patientVisualSummaryRecordCore";
export * from "./patientVisualSummaryPortalCore";
export * from "./patientVisualSummaryAutoRegenCore";
export * from "./patientVisualSummaryCaptureEligibilityCore";
export * from "./patientVisualSummaryPortalPdfCore";
export * from "./imageDuplicateDetectionCore";
export * from "./summary";
export * from "./aiVision";
export * from "./liveAi";
export * from "./types";

export { buildFiOsPatientImageIngestionRequest, resolveFiOsUploadSurface } from "./adapters/fiOsPatientImageAdapter";
export type { FiOsPatientImageAdapterInput } from "./adapters/fiOsPatientImageAdapter";
export { buildHliImageIngestionRequest } from "./adapters/hliImageAdapter";
export type { HliImageAdapterInput } from "./adapters/hliImageAdapter";
export { buildConsultationOsImageIngestionRequest } from "./adapters/consultationOsImageAdapter";
export type { ConsultationOsImageAdapterInput } from "./adapters/consultationOsImageAdapter";
export { buildSurgeryOsImageIngestionRequest } from "./adapters/surgeryOsImageAdapter";
export type { SurgeryOsImageAdapterInput } from "./adapters/surgeryOsImageAdapter";
export { buildFollowUpOutcomeImageIngestionRequest } from "./adapters/followUpOutcomeImageAdapter";
export type { FollowUpOutcomeImageAdapterInput } from "./adapters/followUpOutcomeImageAdapter";
export { buildPatientPortalImageIngestionRequest } from "./adapters/patientPortalImageAdapter";
export type { PatientPortalImageAdapterInput } from "./adapters/patientPortalImageAdapter";
export { buildIiohrImageIngestionRequest } from "./adapters/iiohrImageAdapter";
export type { IiohrImageAdapterInput } from "./adapters/iiohrImageAdapter";
export { buildHairauditImageIngestionRequest } from "./adapters/hairauditImageAdapter";
export type { HairauditImageAdapterInput } from "./adapters/hairauditImageAdapter";
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
export { runHairAuditAiTask } from "./adapters/hairAuditLiveAiAdapter";
export type { RunHairAuditAiTaskInput } from "./adapters/hairAuditLiveAiAdapter";
export { runImagingOsStubPipeline } from "./stubPipeline";
