"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reprocessExpenseDocumentOcrAction } from "@/lib/actions/financial-os-expense-actions";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import {
  FinancialOsFeedbackText,
  FinancialOsTable,
  FinancialOsTh,
  financialOsActionFeedback,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { FiExpenseDocumentRow } from "@/src/lib/financialOs/expenses/expenseOcrCore";

export function ExpenseDocumentsTable(props: {
  tenantId: string;
  documents: FiExpenseDocumentRow[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);

  function reprocess(documentId: string) {
    if (!props.canMutate) return;
    setFeedback(null);
    start(async () => {
      const res = await reprocessExpenseDocumentOcrAction(props.tenantId, {
        document_id: documentId,
      });
      setFeedback(financialOsActionFeedback(res, "OCR reprocessed."));
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
      <FinancialOsTable
        isEmpty={props.documents.length === 0}
        emptyMessage="No receipt or invoice documents yet."
        head={
          <>
            <FinancialOsTh>Uploaded</FinancialOsTh>
            <FinancialOsTh>Kind</FinancialOsTh>
            <FinancialOsTh>OCR</FinancialOsTh>
            <FinancialOsTh>Provider</FinancialOsTh>
            <FinancialOsTh>Expense</FinancialOsTh>
            <FinancialOsTh>Actions</FinancialOsTh>
          </>
        }
      >
        {props.documents.map((doc) => {
          const filename =
            typeof doc.metadata.original_filename === "string"
              ? doc.metadata.original_filename
              : doc.storage_path.split("/").pop() ?? "—";
          const conf =
            typeof doc.ocr_payload.confidence === "number"
              ? doc.ocr_payload.confidence
              : null;
          return (
            <tr key={doc.id} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCell}>
                <div className={financialOsClasses.tableCellStrong}>{filename}</div>
                <div className={financialOsClasses.mutedMeta}>
                  {doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
                </div>
              </td>
              <td className={financialOsClasses.tableCell}>{doc.doc_kind}</td>
              <td className={financialOsClasses.tableCell}>
                <FinancialOsRecordStatusBadge status={doc.ocr_status} />
                {conf != null ? (
                  <div className={financialOsClasses.mutedMeta}>
                    conf {(conf * 100).toFixed(0)}%
                  </div>
                ) : null}
              </td>
              <td className={financialOsClasses.tableCellMono}>
                {doc.ocr_provider || "—"}
              </td>
              <td className={financialOsClasses.tableCellMono}>
                {doc.expense_id ? doc.expense_id.slice(0, 8) + "…" : "—"}
              </td>
              <td className={financialOsClasses.tableCell}>
                <button
                  type="button"
                  className={financialOsClasses.textButton}
                  disabled={!props.canMutate || pending}
                  onClick={() => reprocess(doc.id)}
                >
                  Re-run OCR
                </button>
              </td>
            </tr>
          );
        })}
      </FinancialOsTable>
    </div>
  );
}
