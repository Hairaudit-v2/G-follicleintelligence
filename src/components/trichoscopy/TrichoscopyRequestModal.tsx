"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { FiosTrichoscopyPurpose } from "@/src/lib/integrations/hliTrichoscopy/types";

const PURPOSES: { value: FiosTrichoscopyPurpose; label: string }[] = [
  { value: "consultation", label: "Consultation" },
  { value: "treatment_baseline", label: "Treatment baseline" },
  { value: "treatment_followup", label: "Treatment follow-up" },
  { value: "donor_assessment", label: "Donor assessment" },
  { value: "recipient_assessment", label: "Recipient assessment" },
  { value: "pre_surgery", label: "Pre-surgery" },
  { value: "revision_review", label: "Revision review" },
  { value: "procedure_day", label: "Procedure day" },
  { value: "post_surgery", label: "Post-surgery" },
  { value: "scalp_review", label: "Scalp review" },
  { value: "custom", label: "Custom" },
];

export function TrichoscopyRequestModal(props: {
  tenantId: string;
  patientId: string;
  consultationId?: string | null;
  open: boolean;
  onClose: () => void;
  hasActiveRequest?: boolean;
  allowedPurposes?: FiosTrichoscopyPurpose[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [purpose, setPurpose] = useState<FiosTrichoscopyPurpose>("consultation");
  const [clinicalQuestion, setClinicalQuestion] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [urgency, setUrgency] = useState<"routine" | "priority">("routine");
  const [error, setError] = useState<string | null>(null);

  if (!props.open) return null;

  const purposes = props.allowedPurposes?.length
    ? PURPOSES.filter((p) => props.allowedPurposes!.includes(p.value))
    : PURPOSES;

  async function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/fi-admin/${props.tenantId}/trichoscopy/request`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fiosPatientId: props.patientId,
            purpose,
            clinicalQuestion: clinicalQuestion.trim() || undefined,
            targetDate: targetDate || undefined,
            urgency,
            consultationId: props.consultationId?.trim() || undefined,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Request failed");
          return;
        }
        props.onClose();
        router.refresh();
      } catch {
        setError("Network error creating trichoscopy request.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0B1220] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-100">Request Trichoscopy</h2>
        <p className="mt-1 text-sm text-slate-400">
          Creates a tenant-safe HLI trichoscopy episode linked to this patient.
        </p>
        {props.hasActiveRequest ? (
          <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            An active trichoscopy request already exists for this purpose. Submitting will reuse the
            idempotent request where applicable.
          </p>
        ) : null}

        <label className="mt-4 block text-xs font-medium text-slate-400">
          Purpose
          <select
            className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as FiosTrichoscopyPurpose)}
          >
            {purposes.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-xs font-medium text-slate-400">
          Clinical question (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
            rows={3}
            value={clinicalQuestion}
            onChange={(e) => setClinicalQuestion(e.target.value)}
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-400">
            Target date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-400">
            Urgency
            <select
              className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as "routine" | "priority")}
            >
              <option value="routine">Routine</option>
              <option value="priority">Priority</option>
            </select>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs text-slate-200"
            onClick={props.onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Requesting…" : "Confirm request"}
          </button>
        </div>
      </div>
    </div>
  );
}
