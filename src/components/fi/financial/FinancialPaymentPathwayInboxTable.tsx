"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  assignPaymentPathwayTaskAction,
  updatePaymentPathwayTaskStatusAction,
} from "@/lib/actions/financial-os-payment-pathway-inbox-actions";
import { pathwayTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import { FinancialPaymentPathwayTaskBadge, pathwayTaskTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayTaskBadge";
import {
  filterPathwayInboxRows,
  FinancialPaymentPathwayTaskFilters,
  type PathwayInboxFilterState,
} from "@/src/components/fi/financial/FinancialPaymentPathwayTaskFilters";
import { FinancialPaymentPathwayTaskDrawer } from "@/src/components/fi/financial/FinancialPaymentPathwayTaskDrawer";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import type { PaymentPathwayInboxRow } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";

export function FinancialPaymentPathwayInboxTable(props: {
  tenantId: string;
  rows: PaymentPathwayInboxRow[];
  users: CrmShellUserPickerOption[];
  canMutate: boolean;
}) {
  const { tenantId, rows, users, canMutate } = props;
  const [filters, setFilters] = useState<PathwayInboxFilterState>({
    status: "all",
    priority: "all",
    assigned_to: "all",
    pathway_type: "all",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => filterPathwayInboxRows(rows, filters), [rows, filters]);
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  function onStatus(taskId: string, status: string) {
    setMsg(null);
    start(async () => {
      const res = await updatePaymentPathwayTaskStatusAction(tenantId, { task_id: taskId, status });
      setMsg(res.ok ? "Task updated." : res.error);
    });
  }

  function onAssign(taskId: string, assignedTo: string | null) {
    setMsg(null);
    start(async () => {
      const res = await assignPaymentPathwayTaskAction(tenantId, { task_id: taskId, assigned_to: assignedTo });
      setMsg(res.ok ? "Assignee updated." : res.error);
    });
  }

  return (
    <div className="space-y-4">
      <FinancialPaymentPathwayTaskFilters filters={filters} users={users} onChange={setFilters} />
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
      {pending ? <p className="text-xs text-slate-500">Saving…</p> : null}

      {!filtered.length ? (
        <p className="text-xs text-slate-600">No pathway tasks match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Case</th>
                <th className="px-3 py-2 font-medium">Pathway type</th>
                <th className="px-3 py-2 font-medium">Task type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Assigned to</th>
                <th className="px-3 py-2 font-medium">Due date</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((row) => (
                <tr key={row.id} className="text-slate-800">
                  <td className="px-3 py-2">
                    {row.patient_id ? (
                      <Link href={`/fi-admin/${tenantId}/patients/${encodeURIComponent(row.patient_id)}`} className="text-sky-700 hover:underline">
                        {row.patient_label ?? "Patient"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.case_id ? (
                      <Link href={`/fi-admin/${tenantId}/cases/${encodeURIComponent(row.case_id)}`} className="text-sky-700 hover:underline">
                        {row.case_label ?? "Case"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{pathwayTypeLabel(row.pathway_type)}</td>
                  <td className="px-3 py-2">{pathwayTaskTypeLabel(row.task_type)}</td>
                  <td className="px-3 py-2">
                    <FinancialPaymentPathwayTaskBadge status={row.status} priority={row.priority} variant="light" />
                  </td>
                  <td className="px-3 py-2 font-mono">{row.priority}</td>
                  <td className="px-3 py-2">{row.assigned_to_email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{row.due_date ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{row.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50"
                        onClick={() => setSelectedId(row.id)}
                      >
                        Details
                      </button>
                      {canMutate ? (
                        <>
                          <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50" onClick={() => onStatus(row.id, "in_progress")}>
                            In progress
                          </button>
                          <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50" onClick={() => onStatus(row.id, "waiting_patient")}>
                            Waiting patient
                          </button>
                          <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50" onClick={() => onStatus(row.id, "waiting_provider")}>
                            Waiting provider
                          </button>
                          <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50" onClick={() => onStatus(row.id, "completed")}>
                            Complete
                          </button>
                          <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50" onClick={() => onStatus(row.id, "cancelled")}>
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <FinancialPaymentPathwayTaskDrawer
          tenantId={tenantId}
          row={selected}
          users={users}
          canMutate={canMutate}
          onClose={() => setSelectedId(null)}
          onStatus={onStatus}
          onAssign={onAssign}
        />
      ) : null}
    </div>
  );
}
