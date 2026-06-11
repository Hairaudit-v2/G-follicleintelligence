import type { WorkflowEngine } from "./workflowEngine";
import { workflowPlaceholderSkipped } from "./workflowTypes";

const EVENT = "case.procedure_completed" as const;

/**
 * SurgeryOS automations after a procedure is marked complete.
 * v1: placeholder — coordinates OR readiness, post-op pathways, and booking-derived reminders elsewhere.
 */
export function registerSurgeryWorkflowHandlers(engine: WorkflowEngine): void {
  engine.register({
    id: "fi.os.workflow.case.procedure_completed.placeholder.v1",
    eventName: EVENT,
    handler: async (ctx) => {
      return workflowPlaceholderSkipped({
        automationId: "case.procedure_completed.automation.v1",
        eventually: [
          "Open SurgeryOS post-op task bundles tied to `caseId` / `bookingId` when present.",
          "Seed post-operative reminder jobs consistent with existing `syncBookingReminderJobs` / post-op policies (no provider sends from this handler).",
          "Update Patient Twin surgical episode markers for timeline merge loaders.",
        ],
        ctx: { ...ctx, eventName: EVENT },
      });
    },
  });
}
