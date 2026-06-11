import type { WorkflowEngine } from "./workflowEngine";
import { workflowPlaceholderSkipped } from "./workflowTypes";

const EVENT = "crm.lead.stage_changed" as const;

/**
 * CRM / growth automations when a lead moves pipeline stage (`moveCrmLeadToStage` today).
 * v1: placeholder — complements `fi_crm_activity_events` without duplicating writes here.
 */
export function registerLeadWorkflowHandlers(engine: WorkflowEngine): void {
  engine.register({
    id: "fi.os.workflow.crm.lead.stage_changed.placeholder.v1",
    eventName: EVENT,
    handler: async (ctx) => {
      return workflowPlaceholderSkipped({
        automationId: "crm.lead.stage_changed.automation.v1",
        eventually: [
          "Drive stage-based reminder template sync (`REMINDER_TRIGGER_EVENTS` alignment) when lead-linked bookings exist.",
          "Propose ConsultationOS or SurgeryOS tasks from stage definitions (SLA timers, follow-up calls).",
          "Feed analytics / attribution payloads keyed by `leadId` + stage transition in `payload`.",
        ],
        ctx: { ...ctx, eventName: EVENT },
      });
    },
  });
}
