export { loadHliTrichoscopyConfig, FI_ENABLE_HLI_TRICHOSCOPY } from "./config";
export { hliTrichoscopyFetchJson } from "./client";
export { requestTrichoscopy } from "./commands";
export {
  listTrichoscopyLinksForPatient,
  getTrichoscopyLinkById,
  findTrichoscopyLinkByEpisode,
  listEvidencePacksForLink,
  listOpenTrichoscopyActions,
} from "./queries";
export { processHliTrichoscopyEvent } from "./events";
export {
  verifyHliTrichoscopySignature,
  buildOutboundHliHeaders,
  signHliTrichoscopyPayload,
} from "./eventVerifier";
export { importConfirmedEvidencePack } from "./evidencePacks";
export {
  mapHliTrichoscopyStatusToFios,
  mapEventTypeToFiosStatus,
  resolveFiosTrichoscopyReadiness,
  buildTrichoscopyRequestIdempotencyKey,
  HLI_TO_FIOS_STATUS_MAP_VERSION,
} from "./mappers";
export {
  reconcileTrichoscopyLink,
  reconcileTrichoscopyEpisode,
  reconcileRecentTrichoscopyEvents,
} from "./reconciliation";
export { TRICHOSCOPY_PERMISSIONS } from "./permissions";
export { emitTrichoscopyTelemetry } from "./telemetry";
export * from "./types";
export * from "./errors";

// FI-TRICHOSCOPY-1B consultation integration (pure + types)
export {
  resolveConsultationTrichoscopyStatus,
  resolveConsultationTrichoscopyReadiness,
  HLI_OUTAGE_USER_MESSAGE,
  isTrichoscopyIndicationCode,
} from "./consultation/status";
export {
  assertDiagnosisAcceptanceGuard,
  assertFindingReviewAllowed,
  canTransitionAcknowledgement,
  isAcceptanceAcknowledgement,
} from "./consultation/acknowledgement";
export {
  normaliseTrichoscopyFindingsFromPack,
  groupFindingsByDomain,
} from "./consultation/findings";
export {
  buildPatientSafeTrichoscopySummary,
  formatPatientSafeTrichoscopySummaryText,
} from "./consultation/patientSafeSummary";
export {
  buildConsultationTrichoscopyIdempotencyKey,
  buildFiOsToHliConsultationContext,
  sanitiseFreeText,
} from "./consultation/idempotency";
export * from "./consultation/types";