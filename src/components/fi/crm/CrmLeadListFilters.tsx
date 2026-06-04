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

  return (
    <form method="get" action={action} className="space-y-3 rounded border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-gray-700">
          Stage
          <select
            name="stage"
            defaultValue={query.stageId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any stage</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Status
          <input
            name="status"
            type="text"
            defaultValue={query.status ?? ""}
            placeholder="Exact match"
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Priority
          <input
            name="priority"
            type="text"
            defaultValue={query.priority ?? ""}
            placeholder="Exact match"
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Owner
          <select
            name="owner"
            defaultValue={query.ownerUserId ?? ""}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Any owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.email ?? o.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Sort
          <select
            name="sort"
            defaultValue={query.sort}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {(CRM_LEAD_LIST_SORTS as readonly CrmLeadListSort[]).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Page size
          <select
            name="pageSize"
            defaultValue={String(query.pageSize)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        Search (summary or person name / email hint)
        <input
          name="search"
          type="search"
          defaultValue={query.searchRaw}
          maxLength={200}
          className="mt-1 block w-full max-w-xl rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
          Apply filters
        </button>
        <a href={action} className="text-sm text-blue-600 hover:underline">
          Clear filters
        </a>
      </div>
    </form>
  );
}
