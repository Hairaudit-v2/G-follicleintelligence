/**
 * Canonical FiOS ↔ HLI trichoscopy adapter.
 * Do not call HLI directly from page components or business modules.
 */

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
