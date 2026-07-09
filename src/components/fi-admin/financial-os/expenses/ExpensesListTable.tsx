"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  postExpenseAction,
  voidExpenseAction,
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
import type { FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";

export function ExpensesListTable(props: {
  tenantId: string;
  expenses: FiExpenseRow[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);

  function post(id: string) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await postExpenseAction(props.tenantId, { expense_id: id });
      setFeedback(financialOsActionFeedback(res, "Expense posted."));
      if (res.ok) router.refresh();
    });
  }

  function voidRow(id: string) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await voidExpenseAction(props.tenantId, { expense_id: id });
      setFeedback(financialOsActionFeedback(res, "Expense voided."));
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
      <FinancialOsTable
        isEmpty={props.expenses.length === 0}
        emptyMessage="No expenses yet. Add a manual expense or import a bank CSV."
        head={
          <>
            <FinancialOsTh>Date</FinancialOsTh>
            <FinancialOsTh>Vendor</FinancialOsTh>
            <FinancialOsTh>Category</FinancialOsTh>
            <FinancialOsTh>Amount</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Campaign</FinancialOsTh>
            <FinancialOsTh>Actions</FinancialOsTh>
          </>
        }
      >
        {props.expenses.map((row) => (
          <tr key={row.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCellMono}>{row.expense_date}</td>
            <td className={financialOsClasses.tableCellStrong}>
              {row.vendor_name || "—"}
              {row.description ? (
                <div className={financialOsClasses.mutedMeta}>{row.description}</div>
              ) : null}
            </td>
            <td className={financialOsClasses.tableCell}>
              {row.category_label || row.category_code || "—"}
            </td>
            <td className={financialOsClasses.tableCell}>
              {formatMoneyFromCents(row.amount_cents, row.currency)}
            </td>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={row.status} />
            </td>
            <td className={financialOsClasses.tableCellMono}>
              {row.campaign_key || "—"}
            </td>
            <td className={financialOsClasses.tableCell}>
              <div className="flex flex-wrap gap-2">
                {row.status === "draft" || row.status === "reviewed" ? (
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={!props.canMutate || pending}
                    onClick={() => post(row.id)}
                  >
                    Post
                  </button>
                ) : null}
                {row.status !== "void" ? (
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={!props.canMutate || pending}
                    onClick={() => voidRow(row.id)}
                  >
                    Void
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
