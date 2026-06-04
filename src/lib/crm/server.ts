import "server-only";

/**
 * Service-role CRM data access (Stage 2C / 2D). Import only from Server Components,
 * route handlers, or server actions — never from client components.
 */

export {
  ensureDefaultPipelineStages,
  getEntryPipelineStage,
  loadPipelineStages,
  type EnsureDefaultPipelineStagesResult,
} from "./pipeline";
export {
  createCrmLeadWithPerson,
  loadCrmLeadById,
  type CreateCrmLeadShared,
  type CreateCrmLeadWithPersonResolutionParams,
  type CreateCrmLeadWithResolvedPersonParams,
} from "./leads";
export { updateCrmLeadDetails, type UpdateCrmLeadDetailsInput } from "./leadDetailsUpdate";
export { loadCrmLeadsShellPage } from "./leadList";
export type { CrmShellLeadListItem, CrmShellLeadListPage } from "./types";
export { appendCrmActivityEvent, loadCrmActivityTimelineForLead, type AppendCrmActivityEventParams } from "./activity";
export {
  appendCrmLeadStageHistory,
  loadCrmLeadStageHistory,
  type AppendCrmLeadStageHistoryParams,
} from "./stageHistory";
export { moveCrmLeadToStage, type MoveCrmLeadToStageParams, type MoveCrmLeadToStageResult } from "./stageMovement";
export { createCrmTask, loadCrmTasksForLead, type CreateCrmTaskParams } from "./tasks";
export { createCrmNoteForLead, loadCrmNotesForLead, type CreateCrmNoteForLeadParams } from "./notes";
export { createCrmMessagePreview, loadCrmMessagesForLead, type CreateCrmMessagePreviewParams } from "./messages";
