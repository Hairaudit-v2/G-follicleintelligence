/**
 * Public Team planning API — identity projection types and pure helpers.
 * Server loader: import via `./server`.
 */

export type {
  PlanningCapacityStatus,
  PlanningIdentityAttentionReason,
  PlanningProjectionFacts,
  PlanningRecruitmentCandidateRef,
  PlanningStaffEntry,
  PlanningStaffIdentitySummary,
  PlanningVacancyRef,
} from "@/src/lib/team/planning/types";

export {
  PLANNING_IDENTITY_ATTENTION_LABELS,
  PLANNING_IDENTITY_KPI_SOURCE_SNAPSHOT,
} from "@/src/lib/team/planning/types";

export {
  derivePlanningActionFlags,
  isPlanningIdentityTargetUncertain,
  type PlanningActionFlags,
} from "@/src/lib/team/planning/planningActionFlags";

export { derivePlanningIdentityAttentionReasons } from "@/src/lib/team/planning/planningAttentionReasons";

export { projectPlanningStaffEntry } from "@/src/lib/team/planning/projectPlanningStaffEntry";

export {
  gateProcedureStaffingCandidates,
  type ProcedureStaffingIdentityGate,
} from "@/src/lib/team/planning/procedureStaffingIdentityBridge";
