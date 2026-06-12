/**
 * CRM foundation — types and pure helpers safe to import from any context.
 * Database mutations and service-role loaders live in `./server` (server-only).
 *
 * Do not re-export server-only helpers that depend on `node:crypto` (e.g. `isFiAdminApiKeyMatch`
 * from `./crmFiAdminApiKeyMatch`): importing this barrel from client components would pull those
 * modules into the browser bundle. Import `crmFiAdminApiKeyMatch` directly from server code.
 */

export type {
  CrmPipelineScope,
  CrmKanbanLeadCard,
  CrmLeadConversionState,
  CrmShellClinicOption,
  CrmShellLeadListItem,
  CrmShellLeadListPage,
  CrmShellOrgOption,
  CrmShellUserPickerOption,
  FiCrmActivityEventRow,
  FiCrmLeadCommunicationRow,
  FiCrmLeadNoteRow,
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
  type CrmLeadListViewMode,
  type ParsedCrmLeadListQuery,
} from "./crmLeadListQuery";
export { leadTitleFromRow, personMetadataDisplayLabel } from "./crmLeadListDisplay";
export {
  CRM_MUTATION_ROLES_LOWER,
  CRM_SHELL_NAV_ROLES_LOWER,
  canMutateClinicFromOperatorContext,
  isCrmMutationRole,
  isCrmShellNavRole,
} from "./crmGatePolicy";
export {
  CRM_LEAD_DETAIL_PRIORITY_VALUES,
  CRM_LEAD_DETAIL_STATUS_VALUES,
  collectChangedLeadDetailKeys,
  leadDetailSnapshotsEqual,
  parseCrmLeadAdminMetadataMergeJson,
  parseCrmLeadMetadataJsonInput,
  stableMetadataFingerprint,
  type LeadDetailComparableSnapshot,
  type LeadDetailTrackedKey,
} from "./crmLeadDetailsPolicy";
export { assertMessagePayloadHasNoForbiddenBodyKeys, FORBIDDEN_MESSAGE_BODY_KEYS_LOWER } from "./messageBodyKeysPolicy";
export { groupCrmTasksByBuckets, type CrmTaskUiBucket, type CrmTasksGroupedByBucket } from "./crmTaskBuckets";
export {
  assertCompleteReopenBodyHasNoExtraKeys,
  assertCrmTaskStatusAllowedForWrite,
  assertCrmTaskTypeAllowed,
  CRM_TASK_ACTIVE_STATUS_VALUES,
  CRM_TASK_STATUS_DONE,
  CRM_TASK_TYPE_VALUES,
  isCrmTaskActiveStatus,
  isCrmTaskType,
} from "./crmTaskPolicy";
export {
  collectChangedTaskDetailKeys,
  taskDetailSnapshotFromRowLike,
  type TaskDetailComparableSnapshot,
} from "./crmTaskChangedFields";
export { isTaskOwnedByLeadTenant, type TaskLeadTenantRef } from "./crmTaskOwnership";
export {
  assertCrmLeadNoteBodyNonEmpty,
  assertCrmLeadNoteVisibilityAllowed,
  assertLeadNoteNotArchived,
  CRM_LEAD_NOTE_VISIBILITY_VALUES,
  isCrmLeadNoteVisibility,
  isLeadNoteOwnedByLeadTenant,
  sortCrmLeadNotesForDisplay,
  type CrmLeadNoteVisibility,
} from "./crmLeadNotePolicy";
export {
  collectChangedLeadNoteDetailKeys,
  noteDetailSnapshotFromRowLike,
  type LeadNoteDetailComparableSnapshot,
  type LeadNoteDetailTrackedKey,
} from "./crmLeadNoteChangedFields";
export {
  collectChangedLeadCommunicationDetailKeys,
  leadCommunicationDetailSnapshotFromRowLike,
  type LeadCommunicationDetailComparableSnapshot,
  type LeadCommunicationDetailTrackedKey,
} from "./crmLeadCommunicationChangedFields";
export {
  assertCrmLeadCommunicationDirectionAllowed,
  assertCrmLeadCommunicationMetadataObject,
  assertCrmLeadCommunicationOutcomeAllowed,
  assertCrmLeadCommunicationPreviewBounded,
  assertCrmLeadCommunicationSubjectBounded,
  assertCrmLeadCommunicationTypeAllowed,
  assertLeadCommunicationNotArchived,
  CRM_LEAD_COMMUNICATION_DIRECTION_VALUES,
  CRM_LEAD_COMMUNICATION_MAX_PREVIEW,
  CRM_LEAD_COMMUNICATION_MAX_SUBJECT,
  CRM_LEAD_COMMUNICATION_OUTCOME_VALUES,
  CRM_LEAD_COMMUNICATION_TYPE_VALUES,
  isCrmLeadCommunicationDirection,
  isCrmLeadCommunicationOutcome,
  isCrmLeadCommunicationType,
  isLeadCommunicationOwnedByLeadTenant,
  normaliseCrmLeadCommunicationOutcome,
  sortCrmLeadCommunicationsForDisplay,
  type CrmLeadCommunicationDirection,
  type CrmLeadCommunicationOutcome,
  type CrmLeadCommunicationType,
} from "./crmLeadCommunicationPolicy";
export {
  CRM_LEAD_CONVERSION_MAX_NOTE,
  CRM_LEAD_CONVERSION_SOURCE_SYSTEM,
  assertCaseSeedAllowed,
  assertConversionNoteBounded,
  assertLeadNotYetConverted,
  isLeadConversionRowForTenant,
  type CrmLeadConversionMode,
} from "./crmLeadConversionPolicy";
export {
  assertIdentityMatchesLeadPersonOnly,
  assertNoAmbiguousPersonIdentityInTenant,
  extractPersonIdentitySignals,
  findPersonIdsWithEmailInTenant,
  findPersonIdsWithPhoneDigitsInTenant,
  normalizePhoneDigits,
  type PersonIdentitySignals,
} from "./crmLeadConversionIdentity";
