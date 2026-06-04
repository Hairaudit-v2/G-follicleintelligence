"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCasePostOpTrackingAction } from "@/lib/actions/fi-case-post-op-actions";
import type { CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import { POST_OP_STATUS_VALUES, isPostOpStatus } from "@/src/lib/cases/postOpTypes";

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
  const [recipientRecovery, setRecipientRecovery] = useState(initial?.recipient_recovery_notes ?? "");
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
    setSatisfaction(initial?.patient_satisfaction_score != null ? String(initial.patient_satisfaction_score) : "");
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
        <label className="block text-xs font-medium text-gray-700">
          Post-op status
          <select
            value={postOpStatus}
            onChange={(e) => setPostOpStatus(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            {!isPostOpStatus(postOpStatus) ? <option value={postOpStatus}>{postOpStatus} (legacy)</option> : null}
            {POST_OP_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={instructionsGiven}
            onChange={(e) => setInstructionsGiven(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Post-op instructions given</span>
        </label>
      </div>

      <label className="block text-xs font-medium text-gray-700">
        Medication / aftercare notes
        <textarea
          value={aftercareNotes}
          onChange={(e) => setAftercareNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Donor recovery notes
        <textarea
          value={donorRecovery}
          onChange={(e) => setDonorRecovery(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Recipient recovery notes
        <textarea
          value={recipientRecovery}
          onChange={(e) => setRecipientRecovery(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Complication notes
        <textarea
          value={complicationNotes}
          onChange={(e) => setComplicationNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Outcome notes (early / qualitative)
        <textarea
          value={outcomeNotes}
          onChange={(e) => setOutcomeNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block max-w-xs text-xs font-medium text-gray-700">
        Patient satisfaction (1–10, optional)
        <input
          inputMode="numeric"
          value={satisfaction}
          onChange={(e) => setSatisfaction(e.target.value)}
          placeholder="—"
          className="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
      </label>
      {!satOk ? <p className="text-xs text-amber-800">Use 1–10 or leave blank.</p> : null}
      {!canSaveStatus ? <p className="text-xs text-amber-800">Pick a standard post-op status before saving.</p> : null}
      {msg ? <p className="text-xs text-gray-700">{msg}</p> : null}

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
