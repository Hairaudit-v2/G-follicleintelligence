"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { uploadExpenseReceiptAction } from "@/lib/actions/financial-os-expense-actions";
import {
  FinancialOsFeedbackText,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { EXPENSE_RECEIPT_UPLOAD_FIELDS } from "@/src/lib/financialOs/expenses/expenseDocumentStorageCore";
import type { FiExpenseRow } from "@/src/lib/financialOs/expenses/expenseTypes";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function ExpenseReceiptUploadForm(props: {
  tenantId: string;
  canMutate: boolean;
  /** Recent expenses for attach-to-existing dropdown. */
  expenses?: FiExpenseRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [docKind, setDocKind] = useState<"receipt" | "invoice">("receipt");
  const [fileName, setFileName] = useState<string | null>(null);
  const [attachMode, setAttachMode] = useState<"new" | "existing">("new");
  const [existingExpenseId, setExistingExpenseId] = useState("");

  const attachable = props.expenses?.filter((e) => e.status !== "void").slice(0, 100) ?? [];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!props.canMutate) return;
    setFeedback(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.tenantId, props.tenantId);
    fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.docKind, docKind);

    if (attachMode === "existing") {
      if (!existingExpenseId) {
        setFeedback({ message: "Select an expense to attach the document to.", tone: "error" });
        return;
      }
      fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.expenseId, existingExpenseId);
      fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.createDraftExpense, "false");
    } else {
      fd.delete(EXPENSE_RECEIPT_UPLOAD_FIELDS.expenseId);
      fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.createDraftExpense, "true");
    }

    const file = fd.get(EXPENSE_RECEIPT_UPLOAD_FIELDS.file);
    if (!(file instanceof File) || file.size === 0) {
      setFeedback({ message: "Choose a receipt or invoice file.", tone: "error" });
      return;
    }

    start(async () => {
      const res = await uploadExpenseReceiptAction(fd);
      if (res.ok) {
        setFeedback({
          message: `Uploaded. OCR ${res.ocr_status}${
            res.expense_id
              ? attachMode === "new"
                ? " · draft expense created"
                : " · attached to expense"
              : ""
          }.`,
          tone: "success",
        });
        form.reset();
        setFileName(null);
        setExistingExpenseId("");
        router.refresh();
      } else {
        setFeedback({ message: res.error, tone: "error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={financialOsClasses.formPanel}>
      <h2 className={financialOsClasses.formTitle}>Receipt / invoice upload</h2>
      <p className={financialOsClasses.formHint}>
        Upload an image or PDF. Create a new draft expense or attach to an existing one, then run
        OCR.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={financialOsClasses.formLabel}>
          Type
          <select
            value={docKind}
            onChange={(e) => setDocKind(e.target.value as "receipt" | "invoice")}
            className={financialOsClasses.select}
            disabled={!props.canMutate || pending}
          >
            <option value="receipt" className={financialOsClasses.selectOption}>
              Receipt
            </option>
            <option value="invoice" className={financialOsClasses.selectOption}>
              Supplier invoice
            </option>
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          Attach to
          <select
            value={attachMode}
            onChange={(e) => setAttachMode(e.target.value as "new" | "existing")}
            className={financialOsClasses.select}
            disabled={!props.canMutate || pending}
          >
            <option value="new" className={financialOsClasses.selectOption}>
              New draft expense
            </option>
            <option value="existing" className={financialOsClasses.selectOption}>
              Existing expense
            </option>
          </select>
        </label>
        {attachMode === "existing" ? (
          <label className={`${financialOsClasses.formLabel} sm:col-span-2`}>
            Expense
            <select
              value={existingExpenseId}
              onChange={(e) => setExistingExpenseId(e.target.value)}
              className={financialOsClasses.select}
              disabled={!props.canMutate || pending}
              required
            >
              <option value="" className={financialOsClasses.selectOption}>
                Select expense…
              </option>
              {attachable.map((e) => (
                <option key={e.id} value={e.id} className={financialOsClasses.selectOption}>
                  {e.expense_date} · {e.vendor_name || "—"} ·{" "}
                  {formatMoneyFromCents(e.amount_cents, e.currency)} · {e.status}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={`${financialOsClasses.formLabel} sm:col-span-2`}>
          File
          <input
            type="file"
            name={EXPENSE_RECEIPT_UPLOAD_FIELDS.file}
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
            className={financialOsClasses.input}
            disabled={!props.canMutate || pending}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!props.canMutate || pending}
          className={financialOsClasses.primaryButton}
        >
          {pending ? "Uploading & OCR…" : "Upload & extract"}
        </button>
        {fileName ? <span className={financialOsClasses.mutedMeta}>{fileName}</span> : null}
        {!props.canMutate ? (
          <span className={financialOsClasses.mutedMeta}>You do not have write access.</span>
        ) : null}
      </div>
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </form>
  );
}
