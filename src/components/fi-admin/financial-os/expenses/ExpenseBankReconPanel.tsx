"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  bulkConfirmBankReconMatchesAction,
  confirmBankReconMatchAction,
  rejectBankReconMatchAction,
  suggestBankReconMatchesAction,
} from "@/lib/actions/financial-os-expense-actions";
import {
  FinancialOsFeedbackText,
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { BankReconMatchRow } from "@/src/lib/financialOs/expenses/expenseBankRecon.server";

export type ExpenseBankReconPanelProps = {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  lineCount: number;
  expenseCount: number;
  heuristicMatchCount: number;
  unmatchedLines: number;
  unmatchedExpenses: number;
  persistedMatches: BankReconMatchRow[];
  canMutate: boolean;
};

export function ExpenseBankReconPanel(props: ExpenseBankReconPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);

  const suggested = props.persistedMatches.filter((m) => m.status === "suggested");
  const confirmed = props.persistedMatches.filter((m) => m.status === "confirmed");

  function runSuggest() {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await suggestBankReconMatchesAction(props.tenantId, {
        period_start: props.periodStart,
        period_end: props.periodEnd,
      });
      if (res.ok) {
        setFeedback({
          message: `Persisted ${res.suggested} new suggested match(es).`,
          tone: "success",
        });
        router.refresh();
      } else {
        setFeedback({ message: res.error, tone: "error" });
      }
    });
  }

  function confirm(id: string) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await confirmBankReconMatchAction(props.tenantId, { match_id: id });
      setFeedback(financialOsActionFeedback(res, "Match confirmed."));
      if (res.ok) router.refresh();
    });
  }

  function reject(id: string) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await rejectBankReconMatchAction(props.tenantId, { match_id: id });
      setFeedback(financialOsActionFeedback(res, "Match rejected."));
      if (res.ok) router.refresh();
    });
  }

  return (
    <FinancialOsSectionCard
      kicker="Reconciliation"
      title="Bank import ↔ expense match"
      description={
        <>
          Heuristic preview for {props.periodStart} → {props.periodEnd}, plus persisted
          suggest/confirm workflow. Confirm links expense → import line when empty.
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile label="Import lines" value={String(props.lineCount)} />
        <FinancialOsMetricTile label="Expenses" value={String(props.expenseCount)} />
        <FinancialOsMetricTile
          label="Heuristic matches"
          value={String(props.heuristicMatchCount)}
        />
        <FinancialOsMetricTile label="Suggested (saved)" value={String(suggested.length)} />
        <FinancialOsMetricTile label="Confirmed" value={String(confirmed.length)} />
        <FinancialOsMetricTile label="Unmatched lines" value={String(props.unmatchedLines)} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={financialOsClasses.primaryButton}
          disabled={!props.canMutate || pending}
          onClick={runSuggest}
        >
          {pending ? "Working…" : "Generate suggested matches"}
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canMutate || pending || suggested.length === 0}
          onClick={() => {
            if (!props.canMutate) return;
            setFeedback(null);
            start(async () => {
              const res = await bulkConfirmBankReconMatchesAction(props.tenantId, {
                confirm_all_suggested: true,
              });
              if (res.ok) {
                setFeedback({
                  message: `Bulk confirmed ${res.confirmed} match(es).`,
                  tone: "success",
                });
                router.refresh();
              } else {
                setFeedback({ message: res.error, tone: "error" });
              }
            });
          }}
        >
          Confirm all suggested
        </button>
      </div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />

      <div className="mt-4">
        <FinancialOsTable
          isEmpty={props.persistedMatches.length === 0}
          emptyMessage="No persisted matches yet. Run “Generate suggested matches”."
          head={
            <>
              <FinancialOsTh>Status</FinancialOsTh>
              <FinancialOsTh>Line</FinancialOsTh>
              <FinancialOsTh>Expense</FinancialOsTh>
              <FinancialOsTh>Confidence</FinancialOsTh>
              <FinancialOsTh>Reason</FinancialOsTh>
              <FinancialOsTh>Actions</FinancialOsTh>
            </>
          }
        >
          {props.persistedMatches.map((m) => (
            <tr key={m.id} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCell}>{m.status}</td>
              <td className={financialOsClasses.tableCellMono}>{m.import_line_id.slice(0, 8)}…</td>
              <td className={financialOsClasses.tableCellMono}>{m.expense_id.slice(0, 8)}…</td>
              <td className={financialOsClasses.tableCell}>
                {m.confidence != null ? `${Math.round(m.confidence * 100)}%` : "—"}
              </td>
              <td className={financialOsClasses.tableCell}>{m.match_reason ?? "—"}</td>
              <td className={financialOsClasses.tableCell}>
                {m.status === "suggested" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={financialOsClasses.textButton}
                      disabled={!props.canMutate || pending}
                      onClick={() => confirm(m.id)}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className={financialOsClasses.textButton}
                      disabled={!props.canMutate || pending}
                      onClick={() => reject(m.id)}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </FinancialOsTable>
      </div>
    </FinancialOsSectionCard>
  );
}
