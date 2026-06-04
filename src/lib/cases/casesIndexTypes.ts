import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { CaseIndexRow } from "@/src/lib/cases/caseLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";

/** URL sentinel for “no row yet” in filter selects. */
export const CASES_INDEX_NONE_VALUE = "__none__";

export type CasesWorklistSort = "updated_desc" | "created_desc" | "procedure_date_desc" | "readiness_attention_desc";

export type CasesWorklistReadinessBucket = "ready" | "in_progress" | "needs_attention";

export type CasesIndexQuery = {
  q: string;
  status: string;
  treatment_type: string;
  case_type: string;
  planning_status: string;
  procedure_status: string;
  post_op_status: string;
  readiness: CasesWorklistReadinessBucket | "all";
  sort: CasesWorklistSort;
};

export type CasesIndexFilterOptions = {
  statuses: string[];
  treatment_types: string[];
  case_types: string[];
  planning_statuses: string[];
  procedure_statuses: string[];
  post_op_statuses: string[];
};

export type CaseWorklistRow = CaseIndexRow & {
  tenant_id: string;
  imageCount: number;
  bookingCount: number;
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  postOpTracking: CasePostOpTrackingRow | null;
  followUps: CaseFollowUpRow[];
  readinessPercent: number;
  readinessBucket: CasesWorklistReadinessBucket;
  /** True when any readiness section is `needs_attention` (for worklist sort). */
  readinessNeedsAttention: boolean;
  /** Procedure date YYYY-MM-DD or null (for sorting / display). */
  procedureDate: string | null;
};
