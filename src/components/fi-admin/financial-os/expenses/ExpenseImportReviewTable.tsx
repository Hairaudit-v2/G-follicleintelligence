"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  commitExpenseImportLinesAction,
  updateExpenseImportLineAction,
} from "@/lib/actions/financial-os-expense-actions";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import {
  FinancialOsFeedbackText,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { formatMoneyFromCents } from "@/src/lib/format/money";
import type {
  FiExpenseCategoryRow,
  FiExpenseImportLineRow,
  FiExpenseImportRow,
} from "@/src/lib/financialOs/expenses/expenseTypes";

export function ExpenseImportReviewTable(props: {
  tenantId: string;
  importRow: FiExpenseImportRow;
  lines: FiExpenseImportLineRow[];
  categories: FiExpenseCategoryRow[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const l of props.lines) {
      if (l.status === "draft" || l.status === "accepted") init[l.id] = true;
    }
    return init;
  });

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected]
  );

  function setLineStatus(lineId: string, status: "accepted" | "rejected") {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await updateExpenseImportLineAction(props.tenantId, {
        line_id: lineId,
        status,
      });
      setFeedback(financialOsActionFeedback(res, `Line marked ${status}.`));
      if (res.ok) router.refresh();
    });
  }

  function setLineCategory(lineId: string, categoryId: string) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await updateExpenseImportLineAction(props.tenantId, {
        line_id: lineId,
        category_id: categoryId || null,
        status: "accepted",
      });
      setFeedback(financialOsActionFeedback(res, "Category updated."));
      if (res.ok) router.refresh();
    });
  }

  function commitSelected() {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await commitExpenseImportLinesAction(props.tenantId, {
        import_id: props.importRow.id,
        line_ids: selectedIds,
      });
      if (res.ok) {
        setFeedback({
          message: `Committed ${res.committed} expense(s).`,
          tone: "success",
        });
        router.push(`/fi-admin/${props.tenantId}/financial/expenses`);
        router.refresh();
      } else {
        setFeedback(financialOsActionFeedback(res, "Committed."));
      }
    });
  }

  function commitAllDrafts() {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      // Mark drafts accepted first via commit_all_accepted (server accepts draft + accepted)
      const res = await commitExpenseImportLinesAction(props.tenantId, {
        import_id: props.importRow.id,
        commit_all_accepted: true,
      });
      if (res.ok) {
        setFeedback({
          message: `Committed ${res.committed} expense(s).`,
          tone: "success",
        });
        router.push(`/fi-admin/${props.tenantId}/financial/expenses`);
        router.refresh();
      } else {
        setFeedback(financialOsActionFeedback(res, "Committed."));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={financialOsClasses.primaryButton}
          disabled={!props.canMutate || pending || selectedIds.length === 0}
          onClick={commitSelected}
        >
          Commit selected ({selectedIds.length})
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canMutate || pending}
          onClick={commitAllDrafts}
        >
          Commit all draft/accepted
        </button>
        <span className={financialOsClasses.mutedMeta}>
          Import {props.importRow.status.replace(/_/g, " ")} · {props.lines.length} lines
        </span>
      </div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />

      <FinancialOsTable
        isEmpty={props.lines.length === 0}
        emptyMessage="No lines in this import."
        head={
          <>
            <FinancialOsTh>
              <span className="sr-only">Select</span>
            </FinancialOsTh>
            <FinancialOsTh>Date</FinancialOsTh>
            <FinancialOsTh>Description</FinancialOsTh>
            <FinancialOsTh>Amount</FinancialOsTh>
            <FinancialOsTh>Category</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Actions</FinancialOsTh>
          </>
        }
      >
        {props.lines.map((line) => {
          const selectable = line.status === "draft" || line.status === "accepted";
          return (
            <tr key={line.id} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCell}>
                <input
                  type="checkbox"
                  checked={Boolean(selected[line.id])}
                  disabled={!selectable || !props.canMutate || pending}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [line.id]: e.target.checked }))
                  }
                  aria-label={`Select line ${line.line_index + 1}`}
                />
              </td>
              <td className={financialOsClasses.tableCellMono}>
                {line.transaction_date ?? "—"}
              </td>
              <td className={financialOsClasses.tableCell}>
                <div className={financialOsClasses.tableCellStrong}>
                  {line.vendor_name || line.merchant_hint || "—"}
                </div>
                <div className={financialOsClasses.mutedMeta}>
                  {line.description_raw ?? ""}
                </div>
              </td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(line.amount_cents, line.currency)}
              </td>
              <td className={financialOsClasses.tableCell}>
                <select
                  className={financialOsClasses.inlineSelect}
                  value={line.category_id ?? ""}
                  disabled={!props.canMutate || pending || line.status === "committed"}
                  onChange={(e) => setLineCategory(line.id, e.target.value)}
                >
                  <option value="" className={financialOsClasses.selectOption}>
                    —
                  </option>
                  {props.categories.map((c) => (
                    <option key={c.id} value={c.id} className={financialOsClasses.selectOption}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={financialOsClasses.tableCell}>
                <FinancialOsRecordStatusBadge status={line.status} />
              </td>
              <td className={financialOsClasses.tableCell}>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={!props.canMutate || pending || line.status === "committed"}
                    onClick={() => setLineStatus(line.id, "accepted")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={!props.canMutate || pending || line.status === "committed"}
                    onClick={() => setLineStatus(line.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </FinancialOsTable>
    </div>
  );
}
