import type { CasesIndexQuery, CasesWorklistSort } from "./casesIndexTypes";

const SORT_VALUES: CasesWorklistSort[] = ["updated_desc", "created_desc", "procedure_date_desc", "readiness_attention_desc"];

function firstString(v: string | string[] | undefined): string {
  if (v == null) return "";
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function isSort(s: string): s is CasesWorklistSort {
  return SORT_VALUES.includes(s as CasesWorklistSort);
}

function isReadiness(s: string): s is CasesIndexQuery["readiness"] {
  return s === "all" || s === "ready" || s === "in_progress" || s === "needs_attention";
}

/**
 * Parses cases index URL search params into a normalized query (tenant-agnostic).
 */
export function parseCasesIndexQuery(sp: Record<string, string | string[] | undefined> | undefined): CasesIndexQuery {
  const q = firstString(sp?.q);
  const sortRaw = firstString(sp?.sort);
  const readinessRaw = firstString(sp?.readiness).toLowerCase();

  return {
    q,
    status: firstString(sp?.status),
    treatment_type: firstString(sp?.treatment_type),
    case_type: firstString(sp?.case_type),
    planning_status: firstString(sp?.planning_status),
    procedure_status: firstString(sp?.procedure_status),
    post_op_status: firstString(sp?.post_op_status),
    readiness: isReadiness(readinessRaw) ? readinessRaw : "all",
    sort: isSort(sortRaw) ? sortRaw : "updated_desc",
  };
}
