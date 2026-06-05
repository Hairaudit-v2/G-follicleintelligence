/**
 * Pure URL/query parsing for CRM lead list (Stage 2F).
 */

import { isNonEmptyUuid } from "./validation";

export const CRM_LEAD_LIST_SORTS = [
  "updated_at_desc",
  "created_at_desc",
  "priority_asc",
  "priority_desc",
  "stage_sort_asc",
  "stage_sort_desc",
] as const;

export type CrmLeadListSort = (typeof CRM_LEAD_LIST_SORTS)[number];

export type CrmLeadListViewMode = "list" | "board";

export type ParsedCrmLeadListQuery = {
  /** Primary CRM index layout: table vs kanban (default list). */
  view: CrmLeadListViewMode;
  stageId: string | null;
  status: string | null;
  priority: string | null;
  ownerUserId: string | null;
  searchRaw: string;
  /** ILIKE pattern including `%` wildcards; null when no search. */
  searchPattern: string | null;
  sort: CrmLeadListSort;
  page: number;
  pageSize: number;
  /** Inclusive lower bound on `fi_crm_leads.updated_at` (timestamptz ISO), from `updatedFrom` URL day. */
  updatedAtMin: string | null;
  /** Inclusive upper bound end-of-day on `fi_crm_leads.updated_at`, from `updatedTo` URL day. */
  updatedAtMax: string | null;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function parseCrmLeadListQuery(
  sp: Record<string, string | string[] | undefined> | URLSearchParams
): ParsedCrmLeadListQuery {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) {
      const x = sp.get(k);
      return x ?? undefined;
    }
    return firstString(sp[k]);
  };

  const stageRaw = get("stage")?.trim() || "";
  const stageId = isNonEmptyUuid(stageRaw) ? stageRaw : null;

  const statusRaw = get("status")?.trim() || "";
  const status = statusRaw ? statusRaw : null;

  const priorityRaw = get("priority")?.trim() || "";
  const priority = priorityRaw ? priorityRaw : null;

  const ownerRaw = get("owner")?.trim() || "";
  const ownerUserId = isNonEmptyUuid(ownerRaw) ? ownerRaw : null;

  const searchRaw = (get("search") ?? "").trim().slice(0, 200);

  const viewRaw = (get("view") ?? "list").trim().toLowerCase();
  const view: CrmLeadListViewMode = viewRaw === "board" ? "board" : "list";

  const updatedFromRaw = (get("updatedFrom") ?? "").trim();
  const updatedToRaw = (get("updatedTo") ?? "").trim();
  /** HTML date input `YYYY-MM-DD` → start of UTC day for min, end of UTC day for max. */
  let updatedAtMin: string | null = null;
  let updatedAtMax: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(updatedFromRaw)) {
    updatedAtMin = `${updatedFromRaw}T00:00:00.000Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(updatedToRaw)) {
    updatedAtMax = `${updatedToRaw}T23:59:59.999Z`;
  }

  const sortRaw = (get("sort") ?? "updated_at_desc").trim().toLowerCase();
  const sort = (CRM_LEAD_LIST_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as CrmLeadListSort)
    : "updated_at_desc";

  const pageRaw = get("page");
  const pageNum = Math.max(1, Number.parseInt(String(pageRaw ?? "1"), 10) || 1);

  const psRaw = get("pageSize");
  const pageSizeNum = Number.parseInt(String(psRaw ?? "25"), 10);
  const pageSize = Number.isFinite(pageSizeNum) ? Math.min(100, Math.max(1, pageSizeNum)) : 25;

  return {
    view,
    stageId,
    status,
    priority,
    ownerUserId,
    searchRaw,
    searchPattern: null,
    sort,
    page: pageNum,
    pageSize,
    updatedAtMin,
    updatedAtMax,
  };
}

/** Apply ILIKE wildcards after `escapeIlikePattern` from foundation search. */
export function attachSearchPattern(
  parsed: ParsedCrmLeadListQuery,
  escapedFragment: string | null
): ParsedCrmLeadListQuery {
  if (!parsed.searchRaw.trim() || !escapedFragment) {
    return { ...parsed, searchPattern: null };
  }
  return { ...parsed, searchPattern: `%${escapedFragment}%` };
}

export function crmLeadListOffset(parsed: ParsedCrmLeadListQuery): number {
  return (parsed.page - 1) * parsed.pageSize;
}

export function crmLeadListHasActiveFilters(parsed: ParsedCrmLeadListQuery): boolean {
  return !!(
    parsed.stageId ||
    parsed.status ||
    parsed.priority ||
    parsed.ownerUserId ||
    parsed.searchRaw.trim() ||
    parsed.sort !== "updated_at_desc" ||
    parsed.page > 1 ||
    parsed.pageSize !== 25 ||
    parsed.updatedAtMin ||
    parsed.updatedAtMax
  );
}

export type CrmLeadListHrefQuery = Partial<{
  view: CrmLeadListViewMode;
  stage: string;
  status: string;
  priority: string;
  owner: string;
  search: string;
  sort: CrmLeadListSort;
  page: number;
  pageSize: number;
  updatedFrom: string;
  updatedTo: string;
}>;

export function parsedCrmLeadListToHrefQuery(q: ParsedCrmLeadListQuery): CrmLeadListHrefQuery {
  return {
    view: q.view === "board" ? "board" : undefined,
    stage: q.stageId ?? undefined,
    status: q.status ?? undefined,
    priority: q.priority ?? undefined,
    owner: q.ownerUserId ?? undefined,
    search: q.searchRaw || undefined,
    sort: q.sort,
    page: q.page,
    pageSize: q.pageSize,
    updatedFrom: q.updatedAtMin ? q.updatedAtMin.slice(0, 10) : undefined,
    updatedTo: q.updatedAtMax ? q.updatedAtMax.slice(0, 10) : undefined,
  };
}

export function buildCrmLeadListHref(tenantId: string, q: CrmLeadListHrefQuery): string {
  const sp = new URLSearchParams();
  if (q.view === "board") sp.set("view", "board");
  if (q.stage?.trim()) sp.set("stage", q.stage.trim());
  if (q.status?.trim()) sp.set("status", q.status.trim());
  if (q.priority?.trim()) sp.set("priority", q.priority.trim());
  if (q.owner?.trim()) sp.set("owner", q.owner.trim());
  if (q.search?.trim()) sp.set("search", q.search.trim());
  if (q.sort && q.sort !== "updated_at_desc") sp.set("sort", q.sort);
  if (q.page != null && q.page > 1) sp.set("page", String(q.page));
  if (q.pageSize != null && q.pageSize !== 25) sp.set("pageSize", String(q.pageSize));
  if (q.updatedFrom?.trim()) sp.set("updatedFrom", q.updatedFrom.trim());
  if (q.updatedTo?.trim()) sp.set("updatedTo", q.updatedTo.trim());
  const qs = sp.toString();
  return qs ? `/fi-admin/${tenantId.trim()}/crm?${qs}` : `/fi-admin/${tenantId.trim()}/crm`;
}
