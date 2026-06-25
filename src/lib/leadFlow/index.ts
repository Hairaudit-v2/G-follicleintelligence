/**
 * LeadFlowOS Phase LF-1 — foundation exports.
 * Pure helpers are safe everywhere; server mutations live in `./leadFlowFoundation.server`.
 */

export type {
  FiExternalEventRow,
  FiLeadActivityRow,
  FiLeadRow,
} from "@/src/lib/leadFlow/leadFlowFoundationTypes";

export {
  FI_LEAD_ACTIVITY_TYPES,
  FI_LEAD_CURRENT_STAGES,
  FI_LEAD_EXTERNAL_EVENT_STATUSES,
  FI_LEAD_EXTERNAL_PROVIDERS,
  FI_LEAD_TERMINAL_STAGES,
  assertLeadStageTransition,
  buildExternalEventProcessedActivityMetadata,
  buildLeadScoreUpdatedActivityMetadata,
  buildLeadStageChangedActivityMetadata,
  canTransitionLeadStage,
  clampLeadScore,
  externalEventIdempotencyKey,
  isFiLeadActivityType,
  isFiLeadCurrentStage,
  isFiLeadExternalEventStatus,
  isFiLeadExternalProvider,
  normalizeLeadEmail,
  normalizeLeadPhoneDigits,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";

export type {
  FiLeadActivityType,
  FiLeadCurrentStage,
  FiLeadExternalEventStatus,
  FiLeadExternalProvider,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";

export type {
  HubSpotLeadFlowWebhookKind,
  HubSpotLeadFieldPatch,
  HubSpotLeadUpsertPlan,
  NormalizedHubSpotLeadInput,
} from "@/src/lib/leadFlow/hubspotLeadFlowCore";

export {
  buildLeadUpsertPlan,
  buildStageChangedActivityMetadataFromPlan,
  computeHubSpotLeadFlowProviderEventId,
  flattenHubSpotLeadFlowWebhookBody,
  inferHubSpotLeadFlowWebhookKind,
  leadRowFromNormalizedInput,
  leadUpdateRowFromPatch,
  mapHubSpotStageToLeadStage,
  normalizeHubSpotContactToLead,
  normalizeHubSpotDealToLeadPatch,
  resolveHubSpotContactObjectId,
  resolveHubSpotDealObjectId,
  resolveHubSpotLeadFlowEventType,
} from "@/src/lib/leadFlow/hubspotLeadFlowCore";
