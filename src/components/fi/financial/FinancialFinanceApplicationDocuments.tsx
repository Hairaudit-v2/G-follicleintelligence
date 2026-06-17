"use client";

import { useState, useTransition } from "react";

import {
  addFinanceApplicationDocumentAction,
  updateFinanceApplicationDocumentAction,
  updateFinanceApplicationStatusAction,
} from "@/lib/actions/financial-os-finance-actions";
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
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function addDocument() {
    setMsg(null);
    start(async () => {
      const res = await addFinanceApplicationDocumentAction(props.tenantId, {
        application_id: application.id,
        document_type: docType,
        status: "pending",
      });
      setMsg(res.ok ? "Document row added." : res.error);
    });
  }

  function updateDocStatus(documentId: string, status: (typeof DOCUMENT_STATUSES)[number]) {
    setMsg(null);
    start(async () => {
      const res = await updateFinanceApplicationDocumentAction(props.tenantId, {
        document_id: documentId,
        status,
      });
      setMsg(res.ok ? "Document updated." : res.error);
    });
  }

  function updateStatus(status: (typeof APPLICATION_STATUSES)[number]) {
    setMsg(null);
    start(async () => {
      const res = await updateFinanceApplicationStatusAction(props.tenantId, {
        application_id: application.id,
        status,
      });
      setMsg(res.ok ? "Application status updated." : res.error);
    });
  }

  return (
    <div className="space-y-4 rounded border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{application.provider_name ?? "Finance application"}</p>
          <p className="text-xs text-slate-600">
            Ref {application.application_reference ?? "—"} · Requested {fmtMoney(application.requested_amount_cents)} · Approved{" "}
            {fmtMoney(application.approved_amount_cents)}
          </p>
        </div>
        <FinancialFinanceApplicationStatusBadge status={application.application_status} />
      </div>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Application status
            <select
              defaultValue={application.application_status}
              onChange={(e) => updateStatus(e.target.value as (typeof APPLICATION_STATUSES)[number])}
              disabled={pending}
              className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm"
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
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</h4>
        <ul className="mt-2 space-y-2">
          {(application.documents ?? []).map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs">
              <span className="font-medium text-slate-800">{doc.document_type.replace(/_/g, " ")}</span>
              <span className="text-slate-600">{doc.status}</span>
              {canMutate ? (
                <select
                  defaultValue={doc.status}
                  disabled={pending}
                  onChange={(e) => updateDocStatus(doc.id, e.target.value as (typeof DOCUMENT_STATUSES)[number])}
                  className="rounded border border-slate-200 px-2 py-1"
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
          {!application.documents?.length ? <li className="text-xs text-slate-500">No documents tracked yet.</li> : null}
        </ul>
      </div>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
          <label className="text-xs text-slate-600">
            Add document
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof DOCUMENT_TYPES)[number])}
              className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm"
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
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            Add document
          </button>
        </div>
      ) : null}

      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
