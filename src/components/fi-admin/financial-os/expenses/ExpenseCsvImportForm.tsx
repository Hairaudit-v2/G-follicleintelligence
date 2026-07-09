"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createExpenseImportFromCsvAction } from "@/lib/actions/financial-os-expense-actions";
import {
  FinancialOsFeedbackText,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";

export function ExpenseCsvImportForm(props: {
  tenantId: string;
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [sourceType, setSourceType] = useState<"bank_csv" | "card_csv">("bank_csv");
  const [filename, setFilename] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");

  function onFile(file: File | null) {
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!props.canMutate) return;
    setFeedback(null);
    if (!csvText.trim()) {
      setFeedback({ message: "Choose a CSV file or paste CSV text.", tone: "error" });
      return;
    }

    start(async () => {
      const res = await createExpenseImportFromCsvAction(props.tenantId, {
        source_type: sourceType,
        original_filename: filename,
        csv_text: csvText,
      });
      if (res.ok) {
        setFeedback({
          message: `Import ready: ${res.line_count} line(s). Opening review…`,
          tone: "success",
        });
        router.push(
          `/fi-admin/${props.tenantId}/financial/expenses/imports/${encodeURIComponent(res.import_id)}`
        );
        router.refresh();
      } else {
        setFeedback(financialOsActionFeedback(res, "Import created."));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={financialOsClasses.formPanel}>
      <h2 className={financialOsClasses.formTitle}>Bank / card CSV</h2>
      <p className={financialOsClasses.formHint}>
        Upload a statement export. Lines open in a review queue before becoming expenses. Headers
        like Date, Description, Amount (or Debit/Credit) are auto-detected.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={financialOsClasses.formLabel}>
          Source
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "bank_csv" | "card_csv")}
            className={financialOsClasses.select}
            disabled={!props.canMutate || pending}
          >
            <option value="bank_csv" className={financialOsClasses.selectOption}>
              Bank CSV
            </option>
            <option value="card_csv" className={financialOsClasses.selectOption}>
              Card CSV
            </option>
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          File
          <input
            type="file"
            accept=".csv,text/csv"
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className={`${financialOsClasses.formLabel} sm:col-span-2`}>
          Or paste CSV
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
            placeholder="Date,Description,Amount&#10;01/07/2026,META ADS AUD,-250.00"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!props.canMutate || pending}
          className={financialOsClasses.primaryButton}
        >
          {pending ? "Parsing…" : "Parse & review"}
        </button>
        {filename ? (
          <span className={financialOsClasses.mutedMeta}>{filename}</span>
        ) : null}
      </div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </form>
  );
}
