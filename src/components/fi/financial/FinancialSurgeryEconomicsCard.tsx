"use client";

import { useState, useTransition } from "react";

import {
  createSurgeryProfitabilitySnapshotAction,
  recalculateSurgeryProfitabilitySnapshotAction,
  loadSurgeryProfitabilitySnapshotHistoryAction,
} from "@/lib/actions/financial-os-surgery-economics-actions";
import { cn } from "@/lib/utils";
import {
  FinancialOsFeedbackText,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { SurgeryEconomicsCaseSummary } from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import type { SurgeryProfitabilitySnapshotReadiness } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import type { FiSurgeryProfitabilitySnapshotRow } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";

function formatMoney(cents: number, currency = "AUD"): string {
  const n = cents / 100;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function snapshotStatusLabel(status: SurgeryEconomicsCaseSummary["snapshot_status"]): string {
  switch (status) {
    case "snapshot":
      return "Snapshot recorded";
    case "estimate":
      return "Using live estimate";
    default:
      return "No snapshot";
  }
}

/** Surgery economics summary for case detail with snapshot controls. */
export function FinancialSurgeryEconomicsCard(props: {
  tenantId: string;
  caseId: string;
  summary: SurgeryEconomicsCaseSummary;
  readiness: SurgeryProfitabilitySnapshotReadiness;
  snapshotCount: number;
  canMutate?: boolean;
  variant?: "light" | "dark";
  className?: string;
}) {
  const { summary, readiness, snapshotCount, canMutate = false, variant = "light", className } = props;
  const currency = summary.currency;
  const muted = !summary.financialDataAvailable;
  const panelCls =
    variant === "dark"
      ? "rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
      : "rounded border border-gray-200 bg-gray-50 p-3";
  const labelCls = variant === "dark" ? "text-[0.62rem] uppercase tracking-wide text-slate-500" : "text-[0.62rem] uppercase tracking-wide text-gray-500";
  const valueCls = variant === "dark" ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-gray-900";
  const metaCls = variant === "dark" ? "text-xs text-slate-400" : "text-xs text-gray-600";

  const displayCost = summary.latest_snapshot?.total_cost_cents ?? summary.estimated_total_cost_cents;
  const displayProfit = summary.latest_snapshot?.gross_profit_cents ?? summary.estimated_gross_profit_cents;
  const displayMargin = summary.latest_snapshot?.gross_margin_percentage ?? summary.estimated_gross_margin_percentage;

  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<FiSurgeryProfitabilitySnapshotRow[]>([]);
  const [pending, start] = useTransition();

  function runSnapshot(action: "create" | "recalculate") {
    setFeedback(null);
    start(async () => {
      const fn =
        action === "create" ? createSurgeryProfitabilitySnapshotAction : recalculateSurgeryProfitabilitySnapshotAction;
      const res = await fn(props.tenantId, { case_id: props.caseId });
      if (!res.ok) {
        const detail = res.reasons?.length ? `${res.error} — ${res.reasons.join("; ")}` : res.error;
        setFeedback({ message: detail, tone: "error" });
        return;
      }
      setFeedback({
        message: action === "create" ? "Snapshot created." : "New snapshot version recorded.",
        tone: "success",
      });
    });
  }

  function openHistory() {
    setHistoryOpen(true);
    setFeedback(null);
    start(async () => {
      const res = await loadSurgeryProfitabilitySnapshotHistoryAction(props.tenantId, { case_id: props.caseId });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      setHistory(res.snapshots);
    });
  }

  return (
    <div className={cn(panelCls, className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={variant === "dark" ? "text-sm font-semibold text-slate-50" : "text-sm font-semibold text-gray-900"}>
          FinancialOS · Surgery economics
        </h4>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide",
            summary.snapshot_status === "snapshot"
              ? variant === "dark"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-emerald-50 text-emerald-800"
              : summary.snapshot_status === "estimate"
                ? variant === "dark"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-amber-50 text-amber-800"
                : variant === "dark"
                  ? "bg-slate-500/15 text-slate-400"
                  : "bg-gray-100 text-gray-600"
          )}
        >
          {snapshotStatusLabel(summary.snapshot_status)}
        </span>
      </div>

      {!readiness.ready ? (
        <div
          className={cn(
            "mt-2 rounded border px-3 py-2 text-xs",
            variant === "dark" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          <p className="font-semibold">Needs configuration</p>
          <ul className="mt-1 list-disc pl-4">
            {readiness.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {canMutate ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !readiness.ready}
            onClick={() => runSnapshot("create")}
            className={variant === "dark" ? financialOsClasses.secondaryButton : "rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800 disabled:opacity-50"}
          >
            Create snapshot
          </button>
          <button
            type="button"
            disabled={pending || !readiness.ready}
            onClick={() => runSnapshot("recalculate")}
            className={variant === "dark" ? financialOsClasses.secondaryButton : "rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800 disabled:opacity-50"}
          >
            Recalculate snapshot
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={openHistory}
            className={variant === "dark" ? financialOsClasses.textButton : "text-xs font-medium text-cyan-700 hover:text-cyan-900"}
          >
            View snapshot history ({snapshotCount})
          </button>
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-2">
          <FinancialOsFeedbackText feedback={feedback} />
        </div>
      ) : null}

      {muted ? (
        <p className={cn("mt-2", metaCls)}>Surgery economics unavailable — link procedure type and surgery invoices to enable estimates.</p>
      ) : (
        <>
          {summary.procedure_type ? (
            <p className={cn("mt-1", metaCls)}>
              Procedure: <span className="font-medium">{summary.procedure_type}</span>
            </p>
          ) : null}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className={labelCls}>Invoice total</dt>
              <dd className={valueCls}>{formatMoney(summary.invoice_total_cents, currency)}</dd>
            </div>
            <div>
              <dt className={labelCls}>Collected</dt>
              <dd className={valueCls}>{formatMoney(summary.collected_cents, currency)}</dd>
            </div>
            <div>
              <dt className={labelCls}>Outstanding</dt>
              <dd className={valueCls}>{formatMoney(summary.outstanding_cents, currency)}</dd>
            </div>
            <div>
              <dt className={labelCls}>{summary.snapshot_status === "snapshot" ? "Recorded cost" : "Estimated cost"}</dt>
              <dd className={valueCls}>{formatMoney(displayCost, currency)}</dd>
            </div>
            <div>
              <dt className={labelCls}>{summary.snapshot_status === "snapshot" ? "Recorded profit" : "Estimated margin"}</dt>
              <dd className={valueCls}>
                {formatMoney(displayProfit, currency)}
                <span className={cn("ml-1 font-normal", metaCls)}>({formatPct(displayMargin)})</span>
              </dd>
            </div>
            {summary.latest_snapshot?.calculated_at ? (
              <div>
                <dt className={labelCls}>Last snapshot</dt>
                <dd className={metaCls}>{new Date(summary.latest_snapshot.calculated_at).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        </>
      )}

      {historyOpen ? (
        <div className={cn("mt-3 rounded border p-3", variant === "dark" ? "border-white/10" : "border-gray-200")}>
          <div className="flex items-center justify-between gap-2">
            <p className={labelCls}>Snapshot history (immutable versions)</p>
            <button type="button" onClick={() => setHistoryOpen(false)} className={metaCls}>Close</button>
          </div>
          {history.length === 0 ? (
            <p className={cn("mt-2", metaCls)}>{pending ? "Loading…" : "No snapshots recorded."}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {history.map((s, idx) => (
                <li key={s.id ?? idx} className={cn("rounded px-2 py-1.5", variant === "dark" ? "bg-white/[0.03]" : "bg-white")}>
                  <span className="font-medium">{new Date(s.calculated_at).toLocaleString()}</span>
                  <span className={metaCls}>
                    {" "}
                    · profit {formatMoney(s.gross_profit_cents, currency)} ({formatPct(s.gross_margin_percentage)})
                    · grafts {s.graft_count ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
