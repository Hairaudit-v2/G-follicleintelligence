"use client";

import { useState, useTransition } from "react";

import {
  addInternationalTransferProofAction,
  updateInternationalTransferProofAction,
} from "@/lib/actions/financial-os-international-transfer-actions";
import {
  financialOsClasses,
  FinancialOsFeedbackText,
  financialOsActionFeedback,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { InternationalTransferApplicationRecord } from "@/src/lib/financialOs/financialInternationalTransfer.server";

const PROOF_TYPES = [
  "payment_receipt",
  "bank_confirmation",
  "wise_receipt",
  "swift_confirmation",
  "custom",
] as const;

const PROOF_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

export function FinancialInternationalTransferProofs(props: {
  tenantId: string;
  application: InternationalTransferApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [proofType, setProofType] = useState<(typeof PROOF_TYPES)[number]>("payment_receipt");
  const [fileUrl, setFileUrl] = useState("");
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function addProof() {
    setFeedback(null);
    start(async () => {
      const res = await addInternationalTransferProofAction(props.tenantId, {
        application_id: application.id,
        proof_type: proofType,
        status: "pending",
        file_url: fileUrl.trim() || null,
      });
      setFeedback(financialOsActionFeedback(res, "Proof row added."));
      if (res.ok) setFileUrl("");
    });
  }

  function updateProofStatus(proofId: string, status: (typeof PROOF_STATUSES)[number]) {
    setFeedback(null);
    start(async () => {
      const res = await updateInternationalTransferProofAction(props.tenantId, {
        proof_id: proofId,
        status,
      });
      setFeedback(financialOsActionFeedback(res, "Proof updated."));
    });
  }

  return (
    <div className={`space-y-3 ${financialOsClasses.formPanel}`}>
      <h4 className={financialOsClasses.formTitle}>Proof of payment</h4>
      <ul className="space-y-2">
        {(application.proofs ?? []).map((proof) => (
          <li
            key={proof.id}
            className={`flex flex-wrap items-center justify-between gap-2 text-xs ${financialOsClasses.subPanel}`}
          >
            <span className="font-medium text-slate-100">
              {proof.proof_type.replace(/_/g, " ")}
            </span>
            <span className={financialOsClasses.bodyTextXs}>{proof.status}</span>
            {proof.file_url ? (
              <a
                href={proof.file_url}
                target="_blank"
                rel="noreferrer"
                className={financialOsClasses.inlineLink}
              >
                View file
              </a>
            ) : null}
            {canMutate ? (
              <select
                defaultValue={proof.status}
                disabled={pending}
                onChange={(e) =>
                  updateProofStatus(proof.id, e.target.value as (typeof PROOF_STATUSES)[number])
                }
                className={financialOsClasses.inlineSelect}
              >
                {PROOF_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : null}
          </li>
        ))}
        {!application.proofs?.length ? (
          <li className={financialOsClasses.mutedMeta}>No proof documents tracked yet.</li>
        ) : null}
      </ul>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.06] pt-3">
          <label className={financialOsClasses.formLabel}>
            Proof type
            <select
              value={proofType}
              onChange={(e) => setProofType(e.target.value as (typeof PROOF_TYPES)[number])}
              className={financialOsClasses.select}
            >
              {PROOF_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={financialOsClasses.formLabel}>
            File URL (optional)
            <input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className={`${financialOsClasses.input} w-48`}
              placeholder="https://…"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={addProof}
            className={financialOsClasses.primaryButton}
          >
            Add proof
          </button>
        </div>
      ) : null}

      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </div>
  );
}
