"use client";

import { useState, useTransition } from "react";

import {
  addInternationalTransferProofAction,
  updateInternationalTransferProofAction,
} from "@/lib/actions/financial-os-international-transfer-actions";
import type { InternationalTransferApplicationRecord } from "@/src/lib/financialOs/financialInternationalTransfer.server";

const PROOF_TYPES = ["payment_receipt", "bank_confirmation", "wise_receipt", "swift_confirmation", "custom"] as const;

const PROOF_STATUSES = ["pending", "requested", "received", "verified", "rejected"] as const;

export function FinancialInternationalTransferProofs(props: {
  tenantId: string;
  application: InternationalTransferApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [proofType, setProofType] = useState<(typeof PROOF_TYPES)[number]>("payment_receipt");
  const [fileUrl, setFileUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function addProof() {
    setMsg(null);
    start(async () => {
      const res = await addInternationalTransferProofAction(props.tenantId, {
        application_id: application.id,
        proof_type: proofType,
        status: "pending",
        file_url: fileUrl.trim() || null,
      });
      setMsg(res.ok ? "Proof row added." : res.error);
      if (res.ok) setFileUrl("");
    });
  }

  function updateProofStatus(proofId: string, status: (typeof PROOF_STATUSES)[number]) {
    setMsg(null);
    start(async () => {
      const res = await updateInternationalTransferProofAction(props.tenantId, {
        proof_id: proofId,
        status,
      });
      setMsg(res.ok ? "Proof updated." : res.error);
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proof of payment</h4>
      <ul className="space-y-2">
        {(application.proofs ?? []).map((proof) => (
          <li key={proof.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-medium text-slate-800">{proof.proof_type.replace(/_/g, " ")}</span>
            <span className="text-slate-600">{proof.status}</span>
            {proof.file_url ? (
              <a href={proof.file_url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
                View file
              </a>
            ) : null}
            {canMutate ? (
              <select
                defaultValue={proof.status}
                disabled={pending}
                onChange={(e) => updateProofStatus(proof.id, e.target.value as (typeof PROOF_STATUSES)[number])}
                className="rounded border border-slate-200 px-2 py-1"
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
        {!application.proofs?.length ? <li className="text-xs text-slate-500">No proof documents tracked yet.</li> : null}
      </ul>

      {canMutate ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
          <label className="text-xs text-slate-600">
            Proof type
            <select
              value={proofType}
              onChange={(e) => setProofType(e.target.value as (typeof PROOF_TYPES)[number])}
              className="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm"
            >
              {PROOF_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            File URL (optional)
            <input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="mt-1 block w-48 rounded border border-slate-200 px-2 py-1 text-sm"
              placeholder="https://…"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={addProof}
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            Add proof
          </button>
        </div>
      ) : null}

      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
