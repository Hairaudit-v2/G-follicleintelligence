"use client";

import type { CrmShellUserPickerOption, FiCrmLeadRow } from "@/src/lib/crm/types";
import { crmLeadCardClass, crmPrioritySelectOptions, crmStatusSelectOptions } from "./crmSharedStyles";

export type LeadQuickEditPanelProps = {
  lead: FiCrmLeadRow;
  owners: CrmShellUserPickerOption[];
  summary: string;
  status: string;
  priority: string;
  ownerId: string;
  canMutate: boolean;
  busy?: boolean;
  error?: string | null;
  onSummaryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onOwnerIdChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
};

export function LeadQuickEditPanel({
  lead,
  owners,
  summary,
  status,
  priority,
  ownerId,
  canMutate,
  busy = false,
  error = null,
  onSummaryChange,
  onStatusChange,
  onPriorityChange,
  onOwnerIdChange,
  onSubmit,
}: LeadQuickEditPanelProps) {
  if (!canMutate) return null;

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick edit</h3>
      <form className="space-y-2" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-xs font-medium text-slate-300">Summary</span>
          <textarea
            value={summary}
            onChange={(e) => onSummaryChange(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Status</span>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            >
              {crmStatusSelectOptions(lead.status).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Priority</span>
            <select
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
            >
              <option value="">None</option>
              {crmPrioritySelectOptions(lead.priority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-300">Primary owner</span>
          <select
            value={ownerId}
            onChange={(e) => onOwnerIdChange(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.email ?? o.id}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-700 px-3 py-1.5 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save basics"}
        </button>
      </form>
    </section>
  );
}
