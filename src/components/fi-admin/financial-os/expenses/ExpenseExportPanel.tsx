"use client";

import { useState, useTransition } from "react";

import { exportExpensesPeriodAction } from "@/lib/actions/financial-os-expense-actions";
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

  function run(format: "fi_csv" | "quickbooks_csv" | "quickbooks_json") {
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
        message: `Exported ${res.posted_count} posted / ${res.row_count} total row(s) (${format}).`,
        tone: "success",
      });
    });
  }

  return (
    <div className={financialOsClasses.formPanel}>
      <h2 className={financialOsClasses.formTitle}>Exports & QuickBooks</h2>
      <p className={financialOsClasses.formHint}>
        Download period expenses ({props.periodStart} → {props.periodEnd}). QuickBooks CSV is import-
        ready; JSON drafts scaffold a future QBO Purchase API push. Register the{" "}
        <strong>QuickBooks</strong> connector under OnboardingOS → external connectors for credentials
        (OAuth/API key). Live API sync is not enabled yet.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={financialOsClasses.primaryButton}
          disabled={!props.canExport || pending}
          onClick={() => run("fi_csv")}
        >
          {pending ? "Exporting…" : "FI expenses CSV"}
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
          QuickBooks JSON drafts
        </button>
      </div>
      {!props.canExport ? (
        <p className={`${financialOsClasses.mutedMeta} mt-2`}>
          Export requires FinancialOS access.
        </p>
      ) : null}
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </div>
  );
}
