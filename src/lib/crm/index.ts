/**
 * CRM foundation — types and pure helpers safe to import from any context.
 * Database mutations and service-role loaders live in `./server` (server-only).
 */

export type {
  CrmPipelineScope,
  CrmShellClinicOption,
  CrmShellLeadListItem,
  CrmShellLeadListPage,
  CrmShellOrgOption,
  CrmShellUserPickerOption,
  FiCrmActivityEventRow,
  FiCrmLeadRow,
  FiCrmLeadStageHistoryRow,
  FiCrmMessageRow,
  FiCrmNoteRow,
  FiCrmPipelineStageRow,
  FiCrmTaskRow,
  JsonObject,
} from "./types";
export { DEFAULT_CRM_PIPELINE_KEY, CRM_DEFAULT_PERSON_SOURCE_SYSTEM } from "./types";
export {
  assertDefaultPipelineStageOrderingInvariant,
  buildDefaultPipelineStageInsertRows,
  defaultHairRestorationPipelineDefinitions,
  sortPipelineStagesByOrder,
  type DefaultPipelineStageDefinition,
  type PipelineStageInsertRow,
} from "./pipelineSeedPayload";
export {
  assertNonEmptyUuid,
  isNonEmptyUuid,
  truncateCrmBodyPreview,
  validateCrmMessagePreviewInput,
  type ValidatedCrmMessagePreviewInput,
} from "./validation";
export { normaliseOrgClinicScope, stageRowMatchesOrgClinicScope, type OrgClinicScopeColumns } from "./scope";
export { mapFiCrmLeadRow } from "./leadRow";
export {
  attachSearchPattern,
  buildCrmLeadListHref,
  crmLeadListHasActiveFilters,
  crmLeadListOffset,
  CRM_LEAD_LIST_SORTS,
  parseCrmLeadListQuery,
  parsedCrmLeadListToHrefQuery,
  type CrmLeadListHrefQuery,
  type CrmLeadListSort,
  type ParsedCrmLeadListQuery,
} from "./crmLeadListQuery";
export { leadTitleFromRow, personMetadataDisplayLabel } from "./crmLeadListDisplay";
export { CRM_MUTATION_ROLES_LOWER, CRM_SHELL_NAV_ROLES_LOWER, isCrmMutationRole, isCrmShellNavRole, isFiAdminApiKeyMatch } from "./crmGatePolicy";
export { assertMessagePayloadHasNoForbiddenBodyKeys, FORBIDDEN_MESSAGE_BODY_KEYS_LOWER } from "./messageBodyKeysPolicy";
