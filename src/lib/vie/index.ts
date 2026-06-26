export { VIE_ENGINE_VERSION } from "./vieProtocolTypes";
export type {
  VieCaptureGuideKind,
  VieCaptureReviewPayload,
  VieImagingDomainCompleteness,
  VieInstantIntelligenceResult,
  VieLatestCaptureQuality,
  ViePatientImagingCompleteness,
  VieProtocolCompleteness,
  VieProtocolDef,
  VieProtocolSlug,
  VieProtocolSlotDef,
  VieSlotTier,
} from "./vieProtocolTypes";

export {
  VIE_CAPTURE_POLICY_DEFAULTS,
  parseVieCapturePolicy,
  parseVieCapturePolicyFromTenantMetadata,
  type VieCapturePolicy,
} from "./vieCapturePolicy";

export {
  canAcceptVieCapture,
  deriveClinicalUsability,
  type VieAcceptDecision,
} from "./vieQualityGate";

export {
  VIE_PROTOCOL_CATALOG,
  VIE_PROTOCOL_SLUGS,
  countRequiredProtocolSlots,
  getVieProtocol,
  getVieProtocolOrThrow,
  isDonorDocumentationSlot,
  isVieProtocolSlug,
  vieProtocolCatalogForDbSeed,
} from "./vieProtocolCatalog";

export {
  computeConsultationCompleteness,
  computeDonorDocumentationCompleteness,
  computeSurgicalDocumentationCompleteness,
  enrichPatientImagingCompleteness,
  formatDomainCompletenessDisplay,
  formatVieCompletenessHeadline,
  protocolCompletenessFromProgress,
} from "./vieCompleteness";

export { loadViePatientImagingCompleteness } from "./vieCompleteness.server";

export {
  VIE_INTELLIGENCE_PIPELINE_VERSION,
  buildVieInstantIntelligenceStub,
  persistVieCaptureIntelligence,
  runVieInstantIntelligence,
} from "./vieInstantIntelligence.server";

export {
  VIE_PROTOCOL_REQUIRED_CAPTURE_SOURCES,
  assertVieProtocolCapturePolicy,
  isVieProtocolRequiredSource,
} from "./vieCapturePolicy.server";

export { VIE_FUTURE_ARCHITECTURE, VIE_FUTURE_ENGINE_VERSION } from "./vieFutureArchitecture";
export type { VieFutureArchitecture } from "./vieFutureArchitecture";

export { loadPatientTwinVieSection } from "./viePatientTwinSection.server";
export type { PatientTwinVieSection, VieLatestIntelligenceRow } from "./viePatientTwinSection.server";
