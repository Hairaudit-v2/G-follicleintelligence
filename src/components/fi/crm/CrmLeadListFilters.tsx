"use client";

import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import type { CrmLeadListSort, ParsedCrmLeadListQuery } from "@/src/lib/crm/crmLeadListQuery";
import { CRM_LEAD_LIST_SORTS } from "@/src/lib/crm/crmLeadListQuery";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

export function CrmLeadListFilters({
  tenantId,
  stages,
  owners,
  query,
}: {
  tenantId: string;
  stages: FiCrmPipelineStageRow[];
  owners: CrmShellUserPickerOption[];
  query: ParsedCrmLeadListQuery;
}) {
  const action = `/fi-admin/${tenantId}/crm`;
  const clearHref = query.view === "board" ? `${action}?view=board` : action;

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-white/[0.08] bg-white/[0.03] p-4">
      {query.view === "board" ? <input type="hidden" name="view" value="board" /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-slate-300">
          Stage
          <select
            name="stage"
            defaultValue={query.stageId ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any stage</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Status
          <input
            name="status"
            type="text"
            defaultValue={query.status ?? ""}
            placeholder="Exact match"
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Priority
          <input
            name="priority"
            type="text"
            defaultValue={query.priority ?? ""}
            placeholder="Exact match"
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Owner
          <select
            name="owner"
            defaultValue={query.ownerUserId ?? ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            <option value="">Any owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.email ?? o.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Sort
          <select
            name="sort"
            defaultValue={query.sort}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            {(CRM_LEAD_LIST_SORTS as readonly CrmLeadListSort[]).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Page size
          <select
            name="pageSize"
            defaultValue={String(query.pageSize)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Updated from
          <input
            name="updatedFrom"
            type="date"
            defaultValue={query.updatedAtMin ? query.updatedAtMin.slice(0, 10) : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Updated to
          <input
            name="updatedTo"
            type="date"
            defaultValue={query.updatedAtMax ? query.updatedAtMax.slice(0, 10) : ""}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-300">
        Search (summary or person name / email hint)
        <input
          name="search"
          type="search"
          defaultValue={query.searchRaw}
          maxLength={200}
          className="mt-1 block w-full max-w-xl rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
          Apply filters
        </button>
        <a href={clearHref} className="text-sm text-blue-300 hover:underline">
          Clear filters
        </a>
      </div>
    </form>
  );
}
