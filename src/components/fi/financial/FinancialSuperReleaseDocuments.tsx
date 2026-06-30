"use client";

import { useState, useTransition } from "react";

import {
  addSuperReleaseDocumentAction,
  updateSuperReleaseDocumentAction,
  updateSuperReleaseStatusAction,
} from "@/lib/actions/financial-os-super-release-actions";
import {
  financialOsClasses,
  FinancialOsFeedbackText,
  financialOsActionFeedback,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialSuperReleaseStatusBadge } from "@/src/components/fi/financial/FinancialSuperReleaseStatusBadge";
import type { SuperReleaseApplicationRecord } from "@/src/lib/financialOs/financialSuperRelease.server";

const DOCUMENT_TYPES = [
  "identity_document",
  "medical_letter",
  "financial_hardship_statement",
  "super_release_form",
  "consent_form",
  "bank_details",
  "custom",
] as const;

const DOCUMENT_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

const APPLICATION_STATUSES = [
  "draft",
  "eligibility_review",
  "documents_pending",
  "clinical_letter_required",
  "ready_for_submission",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "release_pending",
  "funds_released",
  "cancelled",
] as const;

function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function FinancialSuperReleaseDocuments(props: {
  tenantId: string;
  application: SuperReleaseApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>("identity_document");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function addDocument() {
    setFeedback(null);
    start(async () => {
      const res = await addSuperReleaseDocumentAction(props.tenantId, {
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
      const res = await updateSuperReleaseDocumentAction(props.tenantId, {
        document_id: documentId,
        status,
      });
      setFeedback(financialOsActionFeedback(res, "Document updated."));
    });
  }

  function updateStatus(status: (typeof APPLICATION_STATUSES)[number]) {
    setFeedback(null);
    start(async () => {
      const res = await updateSuperReleaseStatusAction(props.tenantId, {
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
          <p className={financialOsClasses.formTitle}>
            {application.provider_name ?? "Super release application"}
          </p>
          <p className={financialOsClasses.bodyTextXs}>
            Requested {fmtMoney(application.requested_amount_cents)} · Approved{" "}
            {fmtMoney(application.approved_amount_cents)}
            {application.expected_release_date
              ? ` · Expected release ${application.expected_release_date}`
              : null}
          </p>
        </div>
        <FinancialSuperReleaseStatusBadge status={application.application_status} />
      </div>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className={financialOsClasses.formLabel}>
            Application status
            <select
              defaultValue={application.application_status}
              onChange={(e) =>
                updateStatus(e.target.value as (typeof APPLICATION_STATUSES)[number])
              }
              disabled={pending}
              className={financialOsClasses.select}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
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
            <li
              key={doc.id}
              className={`flex flex-wrap items-center justify-between gap-2 text-xs ${financialOsClasses.subPanel}`}
            >
              <span className="font-medium text-slate-100">
                {doc.document_type.replace(/_/g, " ")}
              </span>
              <span className={financialOsClasses.bodyTextXs}>{doc.status}</span>
              {canMutate ? (
                <select
                  defaultValue={doc.status}
                  disabled={pending}
                  onChange={(e) =>
                    updateDocStatus(doc.id, e.target.value as (typeof DOCUMENT_STATUSES)[number])
                  }
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
          {!application.documents?.length ? (
            <li className={financialOsClasses.mutedMeta}>No documents tracked yet.</li>
          ) : null}
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
          <button
            type="button"
            disabled={pending}
            onClick={addDocument}
            className={financialOsClasses.primaryButton}
          >
            Add document
          </button>
        </div>
      ) : null}

      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </div>
  );
}
