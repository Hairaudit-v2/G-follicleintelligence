"use client";

import { useState, useTransition } from "react";

import {
  createClinicalLetterRecordAction,
  updateClinicalLetterStatusAction,
} from "@/lib/actions/financial-os-super-release-actions";
import type { SuperReleaseApplicationRecord } from "@/src/lib/financialOs/financialSuperRelease.server";

const LETTER_STATUSES = ["draft", "review_required", "approved", "issued"] as const;

export function FinancialSuperReleaseClinicalLetterPanel(props: {
  tenantId: string;
  application: SuperReleaseApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function createLetter() {
    setMsg(null);
    start(async () => {
      const res = await createClinicalLetterRecordAction(props.tenantId, {
        application_id: application.id,
        letter_status: "draft",
      });
      setMsg(res.ok ? "Clinical letter record created." : res.error);
    });
  }

  function updateLetterStatus(letterId: string, letterStatus: (typeof LETTER_STATUSES)[number]) {
    setMsg(null);
    start(async () => {
      const res = await updateClinicalLetterStatusAction(props.tenantId, {
        letter_id: letterId,
        letter_status: letterStatus,
      });
      setMsg(res.ok ? "Clinical letter updated." : res.error);
    });
  }

  return (
    <div className="space-y-3 rounded border border-purple-200 bg-purple-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-purple-900">Clinical letters</h4>
        {canMutate ? (
          <button
            type="button"
            disabled={pending}
            onClick={createLetter}
            className="rounded bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            New letter
          </button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {(application.clinical_letters ?? []).map((letter) => (
          <li key={letter.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-purple-100 bg-white px-3 py-2 text-xs">
            <span className="font-medium text-slate-800">{letter.letter_status.replace(/_/g, " ")}</span>
            <span className="text-slate-600">{letter.issued_at ? `Issued ${letter.issued_at.slice(0, 10)}` : "Not issued"}</span>
            {canMutate ? (
              <select
                defaultValue={letter.letter_status}
                disabled={pending}
                onChange={(e) => updateLetterStatus(letter.id, e.target.value as (typeof LETTER_STATUSES)[number])}
                className="rounded border border-slate-200 px-2 py-1"
              >
                {LETTER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            ) : null}
          </li>
        ))}
        {!application.clinical_letters?.length ? (
          <li className="text-xs text-slate-500">No clinical letters tracked yet.</li>
        ) : null}
      </ul>

      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
