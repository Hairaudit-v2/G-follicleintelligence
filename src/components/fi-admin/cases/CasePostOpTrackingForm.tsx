"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCasePostOpTrackingAction } from "@/lib/actions/fi-case-post-op-actions";
import type { CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import { POST_OP_STATUS_VALUES, isPostOpStatus } from "@/src/lib/cases/postOpTypes";

import { caseFormField } from "./caseFormFieldProps";

const POST_OP_FIELDS = {
  postOpStatus: caseFormField("post-op-status"),
  instructionsGiven: caseFormField("post-op-instructions-given"),
  aftercareNotes: caseFormField("post-op-aftercare-notes"),
  donorRecovery: caseFormField("post-op-donor-recovery"),
  recipientRecovery: caseFormField("post-op-recipient-recovery"),
  complicationNotes: caseFormField("post-op-complication-notes"),
  outcomeNotes: caseFormField("post-op-outcome-notes"),
  satisfaction: caseFormField("post-op-satisfaction"),
} as const;

function satOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 1 || i > 10) return null;
  return i;
}

export function CasePostOpTrackingForm({
  tenantId,
  caseId,
  initial,
}: {
  tenantId: string;
  caseId: string;
  initial: CasePostOpTrackingRow | null;
}) {
  const router = useRouter();
  const [postOpStatus, setPostOpStatus] = useState(initial?.post_op_status ?? "not_started");
  const [instructionsGiven, setInstructionsGiven] = useState(initial?.instructions_given ?? false);
  const [aftercareNotes, setAftercareNotes] = useState(initial?.aftercare_notes ?? "");
  const [donorRecovery, setDonorRecovery] = useState(initial?.donor_recovery_notes ?? "");
  const [recipientRecovery, setRecipientRecovery] = useState(
    initial?.recipient_recovery_notes ?? ""
  );
  const [complicationNotes, setComplicationNotes] = useState(initial?.complication_notes ?? "");
  const [outcomeNotes, setOutcomeNotes] = useState(initial?.outcome_notes ?? "");
  const [satisfaction, setSatisfaction] = useState(
    initial?.patient_satisfaction_score != null ? String(initial.patient_satisfaction_score) : ""
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPostOpStatus(initial?.post_op_status ?? "not_started");
    setInstructionsGiven(initial?.instructions_given ?? false);
    setAftercareNotes(initial?.aftercare_notes ?? "");
    setDonorRecovery(initial?.donor_recovery_notes ?? "");
    setRecipientRecovery(initial?.recipient_recovery_notes ?? "");
    setComplicationNotes(initial?.complication_notes ?? "");
    setOutcomeNotes(initial?.outcome_notes ?? "");
    setSatisfaction(
      initial?.patient_satisfaction_score != null ? String(initial.patient_satisfaction_score) : ""
    );
  }, [initial]);

  const dirty = useMemo(() => {
    if (!initial) return true;
    const sat = satOrNull(satisfaction);
    return (
      postOpStatus !== initial.post_op_status ||
      instructionsGiven !== initial.instructions_given ||
      aftercareNotes !== (initial.aftercare_notes ?? "") ||
      donorRecovery !== (initial.donor_recovery_notes ?? "") ||
      recipientRecovery !== (initial.recipient_recovery_notes ?? "") ||
      complicationNotes !== (initial.complication_notes ?? "") ||
      outcomeNotes !== (initial.outcome_notes ?? "") ||
      sat !== (initial.patient_satisfaction_score ?? null)
    );
  }, [
    initial,
    postOpStatus,
    instructionsGiven,
    aftercareNotes,
    donorRecovery,
    recipientRecovery,
    complicationNotes,
    outcomeNotes,
    satisfaction,
  ]);

  const canSaveStatus = isPostOpStatus(postOpStatus);
  const satParsed = satOrNull(satisfaction);
  const satOk = satisfaction.trim() === "" || satParsed != null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label
          htmlFor={POST_OP_FIELDS.postOpStatus.id}
          className="block text-xs font-medium text-slate-300"
        >
          Post-op status
          <select
            {...POST_OP_FIELDS.postOpStatus}
            value={postOpStatus}
            onChange={(e) => setPostOpStatus(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
          >
            {!isPostOpStatus(postOpStatus) ? (
              <option value={postOpStatus}>{postOpStatus} (legacy)</option>
            ) : null}
            {POST_OP_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor={POST_OP_FIELDS.instructionsGiven.id}
          className="flex items-end gap-2 text-xs font-medium text-slate-300"
        >
          <input
            {...POST_OP_FIELDS.instructionsGiven}
            type="checkbox"
            checked={instructionsGiven}
            onChange={(e) => setInstructionsGiven(e.target.checked)}
            className="rounded border-slate-700"
          />
          <span>Post-op instructions given</span>
        </label>
      </div>

      <label
        htmlFor={POST_OP_FIELDS.aftercareNotes.id}
        className="block text-xs font-medium text-slate-300"
      >
        Medication / aftercare notes
        <textarea
          {...POST_OP_FIELDS.aftercareNotes}
          value={aftercareNotes}
          onChange={(e) => setAftercareNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label
        htmlFor={POST_OP_FIELDS.donorRecovery.id}
        className="block text-xs font-medium text-slate-300"
      >
        Donor recovery notes
        <textarea
          {...POST_OP_FIELDS.donorRecovery}
          value={donorRecovery}
          onChange={(e) => setDonorRecovery(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label
        htmlFor={POST_OP_FIELDS.recipientRecovery.id}
        className="block text-xs font-medium text-slate-300"
      >
        Recipient recovery notes
        <textarea
          {...POST_OP_FIELDS.recipientRecovery}
          value={recipientRecovery}
          onChange={(e) => setRecipientRecovery(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label
        htmlFor={POST_OP_FIELDS.complicationNotes.id}
        className="block text-xs font-medium text-slate-300"
      >
        Complication notes
        <textarea
          {...POST_OP_FIELDS.complicationNotes}
          value={complicationNotes}
          onChange={(e) => setComplicationNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      <label
        htmlFor={POST_OP_FIELDS.outcomeNotes.id}
        className="block text-xs font-medium text-slate-300"
      >
        Outcome notes (early / qualitative)
        <textarea
          {...POST_OP_FIELDS.outcomeNotes}
          value={outcomeNotes}
          onChange={(e) => setOutcomeNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>

      <label
        htmlFor={POST_OP_FIELDS.satisfaction.id}
        className="block max-w-xs text-xs font-medium text-slate-300"
      >
        Patient satisfaction (1–10, optional)
        <input
          {...POST_OP_FIELDS.satisfaction}
          inputMode="numeric"
          value={satisfaction}
          onChange={(e) => setSatisfaction(e.target.value)}
          placeholder="—"
          className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm"
        />
      </label>
      {!satOk ? <p className="text-xs text-amber-300">Use 1–10 or leave blank.</p> : null}
      {!canSaveStatus ? (
        <p className="text-xs text-amber-300">Pick a standard post-op status before saving.</p>
      ) : null}
      {msg ? <p className="text-xs text-slate-300">{msg}</p> : null}

      <button
        type="button"
        disabled={pending || !dirty || !canSaveStatus || !satOk}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await upsertCasePostOpTrackingAction(tenantId, caseId, {
              post_op_status: postOpStatus as (typeof POST_OP_STATUS_VALUES)[number],
              instructions_given: instructionsGiven,
              aftercare_notes: aftercareNotes.trim() ? aftercareNotes.trim() : null,
              donor_recovery_notes: donorRecovery.trim() ? donorRecovery.trim() : null,
              recipient_recovery_notes: recipientRecovery.trim() ? recipientRecovery.trim() : null,
              complication_notes: complicationNotes.trim() ? complicationNotes.trim() : null,
              outcome_notes: outcomeNotes.trim() ? outcomeNotes.trim() : null,
              patient_satisfaction_score: satisfaction.trim() ? satParsed : null,
            });
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            setMsg("Saved.");
            router.refresh();
          });
        }}
        className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Saving…" : initial ? "Save post-op tracking" : "Create post-op tracking"}
      </button>
    </div>
  );
}
