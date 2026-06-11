import type { WorkflowEngine } from "./workflowEngine";
import { workflowPlaceholderSkipped } from "./workflowTypes";

const EVENT = "consultation.completed" as const;

/**
 * ConsultationOS-oriented automations (post-consult tasks, handoff, reminder alignment).
 * v1: placeholder only — see `workflowPlaceholderSkipped` detail.eventually.
 */
export function registerConsultationWorkflowHandlers(engine: WorkflowEngine): void {
  engine.register({
    id: "fi.os.workflow.consultation.completed.placeholder.v1",
    eventName: EVENT,
    handler: async (ctx) => {
      return workflowPlaceholderSkipped({
        automationId: "consultation.completed.automation.v1",
        eventually: [
          "Evaluate ConsultationOS rules to open DoctorOS / SurgeryOS follow-up tasks from template outcomes.",
          "Sync post-consult reminder templates (e.g. post_consult) when consultation outcome implies scheduling windows.",
          "Emit optional internal notifications for consultant handoff when `actorUserId` differs from owner.",
          "Attach structured consultation summary snippets to Patient Twin timeline projections (read models).",
        ],
        ctx: { ...ctx, eventName: EVENT },
      });
    },
  });
}
