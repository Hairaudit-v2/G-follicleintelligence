import "server-only";

/**
 * Service-role CRM data access (Stage 2C). Import only from Server Components,
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
export { appendCrmActivityEvent, type AppendCrmActivityEventParams } from "./activity";
export {
  appendCrmLeadStageHistory,
  loadCrmLeadStageHistory,
  type AppendCrmLeadStageHistoryParams,
} from "./stageHistory";
export { moveCrmLeadToStage, type MoveCrmLeadToStageParams, type MoveCrmLeadToStageResult } from "./stageMovement";
export { createCrmTask, type CreateCrmTaskParams } from "./tasks";
export { createCrmNoteForLead, type CreateCrmNoteForLeadParams } from "./notes";
export { createCrmMessagePreview, type CreateCrmMessagePreviewParams } from "./messages";
