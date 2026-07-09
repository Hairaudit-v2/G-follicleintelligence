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

export function ExpenseReceiptUploadForm(props: {
  tenantId: string;
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [docKind, setDocKind] = useState<"receipt" | "invoice">("receipt");
  const [fileName, setFileName] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!props.canMutate) return;
    setFeedback(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.tenantId, props.tenantId);
    fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.docKind, docKind);
    fd.set(EXPENSE_RECEIPT_UPLOAD_FIELDS.createDraftExpense, "true");

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
            res.expense_id ? ` · draft expense created` : ""
          }. Review the expense row and fix amount/date if needed.`,
          tone: "success",
        });
        form.reset();
        setFileName(null);
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
        Upload an image or PDF. Creates a draft expense and runs OCR (stub heuristics, or OpenAI
        vision when <code className={financialOsClasses.code}>FI_EXPENSE_OCR_PROVIDER=openai_vision</code>{" "}
        and <code className={financialOsClasses.code}>OPENAI_API_KEY</code> are set). Always review
        before posting.
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
