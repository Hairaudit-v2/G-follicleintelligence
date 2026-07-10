"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  postExpenseAction,
  updateExpenseAction,
  voidExpenseAction,
} from "@/lib/actions/financial-os-expense-actions";
import {
  ExpenseLinkPickers,
  type ExpenseLinkSelection,
} from "@/src/components/fi-admin/financial-os/expenses/ExpenseLinkPickers";
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
  campaignSuggestions?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<ExpenseLinkSelection | null>(null);

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

  function openLinks(row: FiExpenseRow) {
    setEditingId(row.id);
    setLinkDraft({
      leadId: row.lead_id,
      leadLabel: row.lead_id ? `Lead ${row.lead_id.slice(0, 8)}…` : null,
      caseId: row.case_id,
      caseLabel: row.case_id ? `Case ${row.case_id.slice(0, 8)}…` : null,
      campaignKey: row.campaign_key ?? "",
    });
  }

  function saveLinks() {
    if (!props.canMutate || !editingId || !linkDraft) return;
    setFeedback(null);
    start(async () => {
      const res = await updateExpenseAction(props.tenantId, {
        expense_id: editingId,
        lead_id: linkDraft.leadId,
        case_id: linkDraft.caseId,
        campaign_key: linkDraft.campaignKey || null,
      });
      setFeedback(financialOsActionFeedback(res, "Links updated."));
      if (res.ok) {
        setEditingId(null);
        setLinkDraft(null);
        router.refresh();
      }
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
            <FinancialOsTh>Links</FinancialOsTh>
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
              {row.ledger_post_transaction_id ? (
                <div className={financialOsClasses.mutedMeta}>ledger linked</div>
              ) : null}
            </td>
            <td className={financialOsClasses.tableCell}>
              <div className="space-y-0.5 text-[11px] text-slate-400">
                {row.campaign_key ? (
                  <div>
                    <span className="text-slate-500">Campaign:</span> {row.campaign_key}
                  </div>
                ) : null}
                {row.lead_id ? (
                  <div>
                    <Link
                      className={financialOsClasses.inlineLink}
                      href={`/fi-admin/${props.tenantId}/crm/leads/${encodeURIComponent(row.lead_id)}`}
                    >
                      Lead
                    </Link>
                  </div>
                ) : null}
                {row.case_id ? (
                  <div>
                    <Link
                      className={financialOsClasses.inlineLink}
                      href={`/fi-admin/${props.tenantId}/cases/${encodeURIComponent(row.case_id)}`}
                    >
                      Case
                    </Link>
                  </div>
                ) : null}
                {!row.campaign_key && !row.lead_id && !row.case_id ? "—" : null}
              </div>
            </td>
            <td className={financialOsClasses.tableCell}>
              <div className="flex flex-wrap gap-2">
                {row.status !== "void" ? (
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={!props.canMutate || pending}
                    onClick={() => openLinks(row)}
                  >
                    Edit links
                  </button>
                ) : null}
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

      {editingId && linkDraft ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setEditingId(null);
              setLinkDraft(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit expense links"
            className={`${financialOsClasses.formPanel} w-full max-w-lg shadow-2xl`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className={financialOsClasses.formTitle}>Edit links</h3>
            <p className={financialOsClasses.formHint}>
              Link lead, case, and campaign for attribution / CPL. Does not change amount or
              ledger.
            </p>
            <div className="mt-4">
              <ExpenseLinkPickers
                tenantId={props.tenantId}
                disabled={!props.canMutate || pending}
                value={linkDraft}
                onChange={setLinkDraft}
                campaignSuggestions={props.campaignSuggestions}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={financialOsClasses.primaryButton}
                disabled={!props.canMutate || pending}
                onClick={saveLinks}
              >
                {pending ? "Saving…" : "Save links"}
              </button>
              <button
                type="button"
                className={financialOsClasses.secondaryButton}
                disabled={pending}
                onClick={() => {
                  setEditingId(null);
                  setLinkDraft(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
