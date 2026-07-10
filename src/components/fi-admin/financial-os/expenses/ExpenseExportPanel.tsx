"use client";

import { useState, useTransition } from "react";

import {
  dryRunAccountingPushAction,
  exportExpensesPeriodAction,
  runAccountingPushAction,
} from "@/lib/actions/financial-os-expense-actions";
import {
  FinancialOsFeedbackText,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExpenseExportPanel(props: {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  canExport: boolean;
}) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);

  function run(
    format: "fi_csv" | "quickbooks_csv" | "quickbooks_json" | "xero_csv"
  ) {
    if (!props.canExport) return;
    setFeedback(null);
    start(async () => {
      const res = await exportExpensesPeriodAction(props.tenantId, {
        period_start: props.periodStart,
        period_end: props.periodEnd,
        format,
      });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      const mime =
        format === "quickbooks_json"
          ? "application/json;charset=utf-8"
          : "text/csv;charset=utf-8";
      downloadText(res.filename, res.content, mime);
      setFeedback({
        message: `Exported ${res.posted_count} posted / ${res.row_count} total (${format}).`,
        tone: "success",
      });
    });
  }

  function dryRun(provider: "quickbooks" | "xero") {
    if (!props.canExport) return;
    setFeedback(null);
    start(async () => {
      const res = await dryRunAccountingPushAction(props.tenantId, {
        provider,
        period_start: props.periodStart,
        period_end: props.periodEnd,
      });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      setFeedback({
        message: `${provider}: ${res.ready ? "READY" : "NOT READY"} — ${res.reason} (${res.payload_count} purchases).`,
        tone: res.ready ? "success" : "warning",
      });
    });
  }

  function livePush(provider: "quickbooks" | "xero") {
    if (!props.canExport) return;
    setFeedback(null);
    start(async () => {
      const res = await runAccountingPushAction(props.tenantId, {
        provider,
        period_start: props.periodStart,
        period_end: props.periodEnd,
      });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      setFeedback({
        message: res.message,
        tone: res.status === "failed" ? "error" : res.status === "partial" ? "warning" : "success",
      });
    });
  }

  return (
    <div className={financialOsClasses.formPanel}>
      <h2 className={financialOsClasses.formTitle}>Exports · QuickBooks · Xero</h2>
      <p className={financialOsClasses.formHint}>
        Period {props.periodStart} → {props.periodEnd}. CSV/JSON downloads always work. Live API
        push stays dry-run until a connector is configured and{" "}
        <code className={financialOsClasses.code}>FI_ACCOUNTING_LIVE_PUSH=1</code>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={financialOsClasses.primaryButton}
          disabled={!props.canExport || pending}
          onClick={() => run("fi_csv")}
        >
          FI CSV
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canExport || pending}
          onClick={() => run("quickbooks_csv")}
        >
          QuickBooks CSV
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canExport || pending}
          onClick={() => run("quickbooks_json")}
        >
          QuickBooks JSON
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canExport || pending}
          onClick={() => run("xero_csv")}
        >
          Xero CSV
        </button>
        <button
          type="button"
          className={financialOsClasses.textButton}
          disabled={!props.canExport || pending}
          onClick={() => dryRun("quickbooks")}
        >
          QB push dry-run
        </button>
        <button
          type="button"
          className={financialOsClasses.textButton}
          disabled={!props.canExport || pending}
          onClick={() => dryRun("xero")}
        >
          Xero push dry-run
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canExport || pending}
          onClick={() => livePush("quickbooks")}
        >
          QB live push
        </button>
        <button
          type="button"
          className={financialOsClasses.secondaryButton}
          disabled={!props.canExport || pending}
          onClick={() => livePush("xero")}
        >
          Xero live push
        </button>
      </div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </div>
  );
}
