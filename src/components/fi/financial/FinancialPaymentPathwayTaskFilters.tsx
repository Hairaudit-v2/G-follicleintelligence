"use client";

import type { PaymentPathwayInboxRow } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

export type PathwayInboxFilterState = {
  status: string;
  priority: string;
  assigned_to: string;
  pathway_type: string;
};

export function FinancialPaymentPathwayTaskFilters(props: {
  filters: PathwayInboxFilterState;
  users: CrmShellUserPickerOption[];
  onChange: (filters: PathwayInboxFilterState) => void;
}) {
  const { filters, users, onChange } = props;

  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-slate-500">Status</span>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
        >
          <option value="all">All open statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="waiting_patient">Waiting patient</option>
          <option value="waiting_provider">Waiting provider</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-slate-500">Priority</span>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={filters.priority}
          onChange={(e) => onChange({ ...filters, priority: e.target.value })}
        >
          <option value="all">All</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-slate-500">Assigned to</span>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={filters.assigned_to}
          onChange={(e) => onChange({ ...filters, assigned_to: e.target.value })}
        >
          <option value="all">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email ?? u.id}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-slate-500">Pathway type</span>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={filters.pathway_type}
          onChange={(e) => onChange({ ...filters, pathway_type: e.target.value })}
        >
          <option value="all">All</option>
          <option value="medical_finance">Medical finance</option>
          <option value="super_release">Super release</option>
          <option value="international_transfer">International transfer</option>
          <option value="installment_plan">Installment plan</option>
          <option value="manual">Manual</option>
        </select>
      </label>
    </div>
  );
}

export function filterPathwayInboxRows(rows: PaymentPathwayInboxRow[], filters: PathwayInboxFilterState): PaymentPathwayInboxRow[] {
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.priority !== "all" && row.priority !== filters.priority) return false;
    if (filters.pathway_type !== "all" && row.pathway_type !== filters.pathway_type) return false;
    if (filters.assigned_to === "unassigned" && row.assigned_to) return false;
    if (filters.assigned_to !== "all" && filters.assigned_to !== "unassigned" && row.assigned_to !== filters.assigned_to) return false;
    return true;
  });
}
