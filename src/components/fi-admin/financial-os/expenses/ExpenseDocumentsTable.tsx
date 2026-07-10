"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  getExpenseDocumentSignedUrlAction,
  reprocessExpenseDocumentOcrAction,
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
import type { FiExpenseDocumentRow } from "@/src/lib/financialOs/expenses/expenseOcrCore";

export function ExpenseDocumentsTable(props: {
  tenantId: string;
  documents: FiExpenseDocumentRow[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewIsImage, setPreviewIsImage] = useState(false);

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

  function openPreview(doc: FiExpenseDocumentRow) {
    // Stage 4: read-capable portal members may preview (server enforces financial_os read).
    setFeedback(null);
    const filename =
      typeof doc.metadata.original_filename === "string"
        ? doc.metadata.original_filename
        : doc.storage_path.split("/").pop() ?? "document";
    start(async () => {
      const res = await getExpenseDocumentSignedUrlAction(props.tenantId, {
        document_id: doc.id,
        ttl_sec: 300,
      });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      const ct = (doc.content_type || "").toLowerCase();
      const isImage = ct.startsWith("image/");
      setPreviewIsImage(isImage);
      setPreviewName(filename);
      setPreviewUrl(res.url);
      if (!isImage && !ct.includes("pdf")) {
        // Open non-previewable types in a new tab
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={pending}
                    onClick={() => openPreview(doc)}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className={financialOsClasses.textButton}
                    disabled={!props.canMutate || pending}
                    onClick={() => reprocess(doc.id)}
                  >
                    Re-run OCR
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </FinancialOsTable>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewUrl(null);
              setPreviewName(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Document preview"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a101f] shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h3 className="truncate text-sm font-semibold text-slate-100">
                {previewName ?? "Preview"}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={financialOsClasses.textButton}
                >
                  Open tab
                </a>
                <button
                  type="button"
                  className={financialOsClasses.secondaryButton}
                  onClick={() => {
                    setPreviewUrl(null);
                    setPreviewName(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-black/40 p-2">
              {previewIsImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={previewName ?? "Receipt"}
                  className="mx-auto max-h-[75vh] max-w-full object-contain"
                />
              ) : (
                <iframe
                  title={previewName ?? "Document"}
                  src={previewUrl}
                  className="h-[75vh] w-full rounded border border-white/[0.06] bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
