"use client";

import { useState, useTransition } from "react";

import {
  addFinanceApplicationDocumentAction,
  updateFinanceApplicationDocumentAction,
  updateFinanceApplicationStatusAction,
} from "@/lib/actions/financial-os-finance-actions";
import { financialOsClasses, FinancialOsFeedbackText, financialOsActionFeedback, type FinancialOsFeedback } from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialFinanceApplicationStatusBadge } from "@/src/components/fi/financial/FinancialFinanceApplicationStatusBadge";
import type { FinanceApplicationRecord } from "@/src/lib/financialOs/financialFinanceApplications.server";

const DOCUMENT_TYPES = [
  "id_verification",
  "bank_statement",
  "medical_letter",
  "super_release_form",
  "income_verification",
  "consent_form",
  "custom",
] as const;

const DOCUMENT_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

const APPLICATION_STATUSES = [
  "draft",
  "documents_pending",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "settlement_pending",
  "settled",
  "cancelled",
] as const;

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function FinancialFinanceApplicationDocuments(props: {
  tenantId: string;
  application: FinanceApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>("id_verification");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function addDocument() {
    setFeedback(null);
    start(async () => {
      const res = await addFinanceApplicationDocumentAction(props.tenantId, {
        application_id: application.id,
        document_type: docType,
        status: "pending",
      });
      setFeedback(financialOsActionFeedback(res, "Document row added."));
    });
  }

  function updateDocStatus(documentId: string, status: (typeof DOCUMENT_STATUSES)[number]) {
    setFeedback(null);
    start(async () => {
      const res = await updateFinanceApplicationDocumentAction(props.tenantId, {
        document_id: documentId,
        status,
      });
      setFeedback(financialOsActionFeedback(res, "Document updated."));
    });
  }

  function updateStatus(status: (typeof APPLICATION_STATUSES)[number]) {
    setFeedback(null);
    start(async () => {
      const res = await updateFinanceApplicationStatusAction(props.tenantId, {
        application_id: application.id,
        status,
      });
      setFeedback(financialOsActionFeedback(res, "Application status updated."));
    });
  }

  return (
    <div className={`space-y-4 ${financialOsClasses.formPanel}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={financialOsClasses.formTitle}>{application.provider_name ?? "Finance application"}</p>
          <p className={financialOsClasses.bodyTextXs}>
            Ref {application.application_reference ?? "—"} · Requested {fmtMoney(application.requested_amount_cents)} · Approved{" "}
            {fmtMoney(application.approved_amount_cents)}
          </p>
        </div>
        <FinancialFinanceApplicationStatusBadge status={application.application_status} />
      </div>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className={financialOsClasses.formLabel}>
            Application status
            <select
              defaultValue={application.application_status}
              onChange={(e) => updateStatus(e.target.value as (typeof APPLICATION_STATUSES)[number])}
              disabled={pending}
              className={financialOsClasses.select}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div>
        <h4 className={financialOsClasses.metricLabel}>Documents</h4>
        <ul className="mt-2 space-y-2">
          {(application.documents ?? []).map((doc) => (
            <li key={doc.id} className={`flex flex-wrap items-center justify-between gap-2 text-xs ${financialOsClasses.subPanel}`}>
              <span className="font-medium text-slate-100">{doc.document_type.replace(/_/g, " ")}</span>
              <span className={financialOsClasses.bodyTextXs}>{doc.status}</span>
              {canMutate ? (
                <select
                  defaultValue={doc.status}
                  disabled={pending}
                  onChange={(e) => updateDocStatus(doc.id, e.target.value as (typeof DOCUMENT_STATUSES)[number])}
                  className={financialOsClasses.inlineSelect}
                >
                  {DOCUMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : null}
            </li>
          ))}
          {!application.documents?.length ? <li className={financialOsClasses.mutedMeta}>No documents tracked yet.</li> : null}
        </ul>
      </div>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.06] pt-3">
          <label className={financialOsClasses.formLabel}>
            Add document
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof DOCUMENT_TYPES)[number])}
              className={financialOsClasses.select}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={pending} onClick={addDocument} className={financialOsClasses.primaryButton}>
            Add document
          </button>
        </div>
      ) : null}

      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </div>
  );
}
