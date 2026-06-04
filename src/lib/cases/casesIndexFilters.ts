import type { CaseReadinessHealth } from "./caseReadinessTypes";
import { caseReadinessHealthLabel } from "./caseReadinessLabels";
import type { CasesIndexPageSize, CasesIndexQuery, CasesWorklistSort } from "./casesIndexTypes";
import { CASES_INDEX_DEFAULT_PAGE_SIZE, CASES_INDEX_PAGE_SIZE_OPTIONS } from "./casesIndexTypes";

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

function parsePage(sp: Record<string, string | string[] | undefined> | undefined): number {
  const raw = parseInt(firstString(sp?.page), 10);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}

function parsePageSize(sp: Record<string, string | string[] | undefined> | undefined): CasesIndexPageSize {
  const raw = parseInt(firstString(sp?.pageSize), 10);
  if (CASES_INDEX_PAGE_SIZE_OPTIONS.includes(raw as CasesIndexPageSize)) return raw as CasesIndexPageSize;
  return CASES_INDEX_DEFAULT_PAGE_SIZE;
}

/** Maps worklist readiness bucket to a section health label (ready → complete). */
export function casesWorklistReadinessFilterLabel(bucket: Exclude<CasesIndexQuery["readiness"], "all">): string {
  const health: CaseReadinessHealth =
    bucket === "ready" ? "complete" : bucket === "in_progress" ? "in_progress" : "needs_attention";
  return caseReadinessHealthLabel(health);
}

/**
 * Serializes the worklist query for URLs (omits defaults where helpful).
 */
export function buildCasesWorklistQueryString(q: CasesIndexQuery): string {
  const p = new URLSearchParams();
  if (q.q.trim()) p.set("q", q.q.trim());
  if (q.status.trim()) p.set("status", q.status.trim());
  if (q.treatment_type.trim()) p.set("treatment_type", q.treatment_type.trim());
  if (q.case_type.trim()) p.set("case_type", q.case_type.trim());
  if (q.planning_status.trim()) p.set("planning_status", q.planning_status.trim());
  if (q.procedure_status.trim()) p.set("procedure_status", q.procedure_status.trim());
  if (q.post_op_status.trim()) p.set("post_op_status", q.post_op_status.trim());
  if (q.readiness !== "all") p.set("readiness", q.readiness);
  if (q.sort !== "updated_desc") p.set("sort", q.sort);
  if (q.page !== 1) p.set("page", String(q.page));
  if (q.pageSize !== CASES_INDEX_DEFAULT_PAGE_SIZE) p.set("pageSize", String(q.pageSize));
  return p.toString();
}

export function casesWorklistHref(tenantId: string, q: CasesIndexQuery, patch: Partial<CasesIndexQuery> = {}): string {
  const merged: CasesIndexQuery = { ...q, ...patch };
  const qs = buildCasesWorklistQueryString(merged);
  const base = `/fi-admin/${tenantId.trim()}/cases`;
  return qs ? `${base}?${qs}` : base;
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
    page: parsePage(sp),
    pageSize: parsePageSize(sp),
  };
}
