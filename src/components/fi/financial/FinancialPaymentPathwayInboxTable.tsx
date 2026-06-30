"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  assignPaymentPathwayTaskAction,
  updatePaymentPathwayTaskStatusAction,
} from "@/lib/actions/financial-os-payment-pathway-inbox-actions";
import {
  FinancialOsFeedbackText,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsFilteredEmptyMessage,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { pathwayTypeLabel } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import {
  FinancialPaymentPathwayTaskBadge,
  pathwayTaskTypeLabel,
} from "@/src/components/fi/financial/FinancialPaymentPathwayTaskBadge";
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
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => filterPathwayInboxRows(rows, filters), [rows, filters]);
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  function onStatus(taskId: string, status: string) {
    setFeedback(null);
    start(async () => {
      const res = await updatePaymentPathwayTaskStatusAction(tenantId, { task_id: taskId, status });
      setFeedback(financialOsActionFeedback(res, "Task updated."));
    });
  }

  function onAssign(taskId: string, assignedTo: string | null) {
    setFeedback(null);
    start(async () => {
      const res = await assignPaymentPathwayTaskAction(tenantId, {
        task_id: taskId,
        assigned_to: assignedTo,
      });
      setFeedback(financialOsActionFeedback(res, "Assignee updated."));
    });
  }

  return (
    <div className="space-y-4">
      <FinancialPaymentPathwayTaskFilters filters={filters} users={users} onChange={setFilters} />
      <FinancialOsFeedbackText
        message={feedback?.message ?? null}
        tone={feedback?.tone}
        className="mt-1"
      />
      {pending ? <p className={financialOsClasses.mutedMeta}>Saving…</p> : null}

      <FinancialOsTable
        isEmpty={filtered.length === 0}
        emptyMessage={financialOsFilteredEmptyMessage(
          rows.length > 0,
          "No pathway tasks yet.",
          "No pathway tasks match these filters."
        )}
        emptyHint={
          rows.length > 0 && filtered.length === 0
            ? "Try resetting status, priority, or assignee filters."
            : undefined
        }
        head={
          <>
            <FinancialOsTh>Patient</FinancialOsTh>
            <FinancialOsTh>Case</FinancialOsTh>
            <FinancialOsTh>Pathway type</FinancialOsTh>
            <FinancialOsTh>Task type</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh className="hidden lg:table-cell">Priority</FinancialOsTh>
            <FinancialOsTh>Assigned to</FinancialOsTh>
            <FinancialOsTh>Due date</FinancialOsTh>
            <FinancialOsTh className="hidden xl:table-cell">Created</FinancialOsTh>
            <FinancialOsTh>Actions</FinancialOsTh>
          </>
        }
      >
        {filtered.map((row) => (
          <tr key={row.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCell}>
              {row.patient_id ? (
                <Link
                  href={`/fi-admin/${tenantId}/patients/${encodeURIComponent(row.patient_id)}`}
                  className={financialOsClasses.inlineLink}
                >
                  {row.patient_label ?? "Patient"}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td className={financialOsClasses.tableCell}>
              {row.case_id ? (
                <Link
                  href={`/fi-admin/${tenantId}/cases/${encodeURIComponent(row.case_id)}`}
                  className={financialOsClasses.inlineLink}
                >
                  {row.case_label ?? "Case"}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td className={financialOsClasses.tableCell}>{pathwayTypeLabel(row.pathway_type)}</td>
            <td className={financialOsClasses.tableCell}>{pathwayTaskTypeLabel(row.task_type)}</td>
            <td className={financialOsClasses.tableCell}>
              <FinancialPaymentPathwayTaskBadge
                status={row.status}
                priority={row.priority}
                variant="dark"
              />
            </td>
            <td className={`hidden lg:table-cell ${financialOsClasses.tableCellMono}`}>
              {row.priority}
            </td>
            <td className={financialOsClasses.tableCell}>{row.assigned_to_email ?? "—"}</td>
            <td className={financialOsClasses.tableCellMono}>{row.due_date ?? "—"}</td>
            <td className={`hidden xl:table-cell ${financialOsClasses.tableCellMono}`}>
              {row.created_at.slice(0, 10)}
            </td>
            <td className={financialOsClasses.tableCell}>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => setSelectedId(row.id)}
                >
                  Details
                </button>
                {canMutate ? (
                  <div className="hidden flex-wrap gap-1 md:flex">
                    <button
                      type="button"
                      className={financialOsClasses.secondaryButton}
                      onClick={() => onStatus(row.id, "in_progress")}
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      className={financialOsClasses.secondaryButton}
                      onClick={() => onStatus(row.id, "waiting_patient")}
                    >
                      Waiting patient
                    </button>
                    <button
                      type="button"
                      className={financialOsClasses.secondaryButton}
                      onClick={() => onStatus(row.id, "waiting_provider")}
                    >
                      Waiting provider
                    </button>
                    <button
                      type="button"
                      className={financialOsClasses.secondaryButton}
                      onClick={() => onStatus(row.id, "completed")}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className={financialOsClasses.secondaryButton}
                      onClick={() => onStatus(row.id, "cancelled")}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </FinancialOsTable>

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
