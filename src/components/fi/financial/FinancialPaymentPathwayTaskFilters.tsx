"use client";

import { FinancialOsPillFilterBar } from "@/src/components/fi-admin/financial-os/FinancialOsPillFilterBar";
import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { PaymentPathwayInboxRow } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";

export type PathwayInboxFilterState = {
  status: string;
  priority: string;
  assigned_to: string;
  pathway_type: string;
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All open" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_patient", label: "Waiting patient" },
  { value: "waiting_provider", label: "Waiting provider" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const PRIORITY_FILTER_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export function FinancialPaymentPathwayTaskFilters(props: {
  filters: PathwayInboxFilterState;
  users: CrmShellUserPickerOption[];
  onChange: (filters: PathwayInboxFilterState) => void;
}) {
  const { filters, users, onChange } = props;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <FinancialOsPillFilterBar
          label="Status"
          value={filters.status}
          options={STATUS_FILTER_OPTIONS}
          onChange={(status) => onChange({ ...filters, status })}
          ariaLabel="Pathway task status filter"
        />
        <FinancialOsPillFilterBar
          label="Priority"
          value={filters.priority}
          options={PRIORITY_FILTER_OPTIONS}
          onChange={(priority) => onChange({ ...filters, priority })}
          ariaLabel="Pathway task priority filter"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className={financialOsClasses.formLabel}>Assigned to</span>
          <select
            className={financialOsClasses.inlineSelect}
            value={filters.assigned_to}
            onChange={(e) => onChange({ ...filters, assigned_to: e.target.value })}
          >
            <option value="all" className={financialOsClasses.selectOption}>
              Anyone
            </option>
            <option value="unassigned" className={financialOsClasses.selectOption}>
              Unassigned
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id} className={financialOsClasses.selectOption}>
                {u.email ?? u.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className={financialOsClasses.formLabel}>Pathway type</span>
          <select
            className={financialOsClasses.inlineSelect}
            value={filters.pathway_type}
            onChange={(e) => onChange({ ...filters, pathway_type: e.target.value })}
          >
            <option value="all" className={financialOsClasses.selectOption}>
              All types
            </option>
            <option value="medical_finance" className={financialOsClasses.selectOption}>
              Medical finance
            </option>
            <option value="super_release" className={financialOsClasses.selectOption}>
              Super release
            </option>
            <option value="international_transfer" className={financialOsClasses.selectOption}>
              International transfer
            </option>
            <option value="installment_plan" className={financialOsClasses.selectOption}>
              Installment plan
            </option>
            <option value="manual" className={financialOsClasses.selectOption}>
              Manual
            </option>
          </select>
        </label>
      </div>
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
