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

export type ParsedCrmLeadListQuery = {
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
    stageId,
    status,
    priority,
    ownerUserId,
    searchRaw,
    searchPattern: null,
    sort,
    page: pageNum,
    pageSize,
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
    parsed.pageSize !== 25
  );
}

export type CrmLeadListHrefQuery = Partial<{
  stage: string;
  status: string;
  priority: string;
  owner: string;
  search: string;
  sort: CrmLeadListSort;
  page: number;
  pageSize: number;
}>;

export function parsedCrmLeadListToHrefQuery(q: ParsedCrmLeadListQuery): CrmLeadListHrefQuery {
  return {
    stage: q.stageId ?? undefined,
    status: q.status ?? undefined,
    priority: q.priority ?? undefined,
    owner: q.ownerUserId ?? undefined,
    search: q.searchRaw || undefined,
    sort: q.sort,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export function buildCrmLeadListHref(tenantId: string, q: CrmLeadListHrefQuery): string {
  const sp = new URLSearchParams();
  if (q.stage?.trim()) sp.set("stage", q.stage.trim());
  if (q.status?.trim()) sp.set("status", q.status.trim());
  if (q.priority?.trim()) sp.set("priority", q.priority.trim());
  if (q.owner?.trim()) sp.set("owner", q.owner.trim());
  if (q.search?.trim()) sp.set("search", q.search.trim());
  if (q.sort && q.sort !== "updated_at_desc") sp.set("sort", q.sort);
  if (q.page != null && q.page > 1) sp.set("page", String(q.page));
  if (q.pageSize != null && q.pageSize !== 25) sp.set("pageSize", String(q.pageSize));
  const qs = sp.toString();
  return qs ? `/fi-admin/${tenantId.trim()}/crm?${qs}` : `/fi-admin/${tenantId.trim()}/crm`;
}
