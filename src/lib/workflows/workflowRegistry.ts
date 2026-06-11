import { workflowEngine, type WorkflowEngine } from "./workflowEngine";
import { registerConsultationWorkflowHandlers } from "./consultationWorkflow";
import { registerLeadWorkflowHandlers } from "./leadWorkflow";
import { registerPathologyWorkflowHandlers } from "./pathologyWorkflow";
import { registerSurgeryWorkflowHandlers } from "./surgeryWorkflow";

/**
 * Registers all first-party FI OS workflow handlers on the given engine.
 * Call once during server startup or immediately before `dispatch` in environments that need handlers.
 * (Not invoked from `ingestFiEvent` yet — see README "Integration points".)
 */
export function registerDefaultFiOsWorkflowHandlers(engine: WorkflowEngine = workflowEngine): void {
  registerConsultationWorkflowHandlers(engine);
  registerPathologyWorkflowHandlers(engine);
  registerSurgeryWorkflowHandlers(engine);
  registerLeadWorkflowHandlers(engine);
}
