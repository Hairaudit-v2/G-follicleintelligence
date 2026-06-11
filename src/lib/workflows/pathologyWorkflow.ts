import type { WorkflowEngine } from "./workflowEngine";
import { workflowPlaceholderSkipped } from "./workflowTypes";

const REQUESTED = "pathology.requested" as const;
const RESULT_UPLOADED = "pathology.result_uploaded" as const;

/**
 * DoctorOS / clinical lab workflow automations for pathology requests and results.
 * v1: placeholders — map from existing CRM activity kinds (`pathology.blood_request.*`, `pathology.blood_result.uploaded`) at call sites when wiring ingest/mutators.
 */
export function registerPathologyWorkflowHandlers(engine: WorkflowEngine): void {
  engine.register({
    id: "fi.os.workflow.pathology.requested.placeholder.v1",
    eventName: REQUESTED,
    handler: async (ctx) => {
      return workflowPlaceholderSkipped({
        automationId: "pathology.requested.automation.v1",
        eventually: [
          "Create or update DoctorOS checklist items for blood draw / kit dispatch when `pathologyRequestId` is present.",
          "Enqueue patient-facing instructions (without calling email/SMS providers here — delegate to existing send-to-patient flows behind feature flags).",
          "Mirror status into Patient Twin clinical timeline summaries for care team visibility.",
        ],
        ctx: { ...ctx, eventName: REQUESTED },
      });
    },
  });

  engine.register({
    id: "fi.os.workflow.pathology.result_uploaded.placeholder.v1",
    eventName: RESULT_UPLOADED,
    handler: async (ctx) => {
      return workflowPlaceholderSkipped({
        automationId: "pathology.result_uploaded.automation.v1",
        eventually: [
          "Trigger AI interpretation jobs when policy allows, reusing `pathologyResultId` correlation.",
          "Notify assigned clinical staff (in-app / task queue) when results cross review thresholds.",
          "Advance CRM or case readiness states when pathology gates surgery scheduling.",
        ],
        ctx: { ...ctx, eventName: RESULT_UPLOADED },
      });
    },
  });
}
