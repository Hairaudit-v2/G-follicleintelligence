"use client";

import { useState, useTransition } from "react";

import {
  createClinicalLetterRecordAction,
  updateClinicalLetterStatusAction,
} from "@/lib/actions/financial-os-super-release-actions";
import { financialOsClasses, FinancialOsFeedbackText, financialOsActionFeedback, type FinancialOsFeedback } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { SuperReleaseApplicationRecord } from "@/src/lib/financialOs/financialSuperRelease.server";

const LETTER_STATUSES = ["draft", "review_required", "approved", "issued"] as const;

export function FinancialSuperReleaseClinicalLetterPanel(props: {
  tenantId: string;
  application: SuperReleaseApplicationRecord;
  canMutate: boolean;
}) {
  const { application, canMutate } = props;
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function createLetter() {
    setFeedback(null);
    start(async () => {
      const res = await createClinicalLetterRecordAction(props.tenantId, {
        application_id: application.id,
        letter_status: "draft",
      });
      setFeedback(financialOsActionFeedback(res, "Clinical letter record created."));
    });
  }

  function updateLetterStatus(letterId: string, letterStatus: (typeof LETTER_STATUSES)[number]) {
    setFeedback(null);
    start(async () => {
      const res = await updateClinicalLetterStatusAction(props.tenantId, {
        letter_id: letterId,
        letter_status: letterStatus,
      });
      setFeedback(financialOsActionFeedback(res, "Clinical letter updated."));
    });
  }

  return (
    <div className={`space-y-3 ${financialOsClasses.formPanel}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={financialOsClasses.formTitle}>Clinical letters</h4>
        {canMutate ? (
          <button type="button" disabled={pending} onClick={createLetter} className={financialOsClasses.primaryButton}>
            New letter
          </button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {(application.clinical_letters ?? []).map((letter) => (
          <li key={letter.id} className={`flex flex-wrap items-center justify-between gap-2 text-xs ${financialOsClasses.subPanel}`}>
            <span className="font-medium text-slate-100">{letter.letter_status.replace(/_/g, " ")}</span>
            <span className={financialOsClasses.bodyTextXs}>
              {letter.issued_at ? `Issued ${letter.issued_at.slice(0, 10)}` : "Not issued"}
            </span>
            {canMutate ? (
              <select
                defaultValue={letter.letter_status}
                disabled={pending}
                onChange={(e) => updateLetterStatus(letter.id, e.target.value as (typeof LETTER_STATUSES)[number])}
                className={financialOsClasses.inlineSelect}
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
          <li className={financialOsClasses.mutedMeta}>No clinical letters tracked yet.</li>
        ) : null}
      </ul>

      <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
    </div>
  );
}
