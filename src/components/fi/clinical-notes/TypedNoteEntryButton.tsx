"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { createTypedClinicalNoteAction } from "@/lib/actions/fi-clinical-voice-note-actions";
import { cn } from "@/lib/utils";

/**
 * Patient-profile typed clinical note — simple textarea → fi_clinical_notes.
 * Same clinical write gate as voice notes; no AI pipeline.
 */
export function TypedNoteEntryButton({
  tenantId,
  patientId,
  caseId,
  consultationId,
  label = "Typed note",
  className,
}: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  consultationId?: string | null;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = useCallback(() => {
    setOpen(false);
    setErr(null);
    setBody("");
  }, []);

  const save = () => {
    const text = body.trim();
    if (!text) {
      setErr("Enter a note before saving.");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await createTypedClinicalNoteAction({
        tenantId,
        patientId,
        body: text,
        caseId: caseId ?? null,
        consultationId: consultationId ?? null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      close();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
          setBody("");
        }}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded border border-violet-300 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/15"
        }
        data-testid="typed-note-entry-button"
      >
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="typed-note-dialog-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/[0.08] bg-[#0F1629] p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="typed-note-dialog-title" className="text-base font-semibold text-slate-100">
                  Add typed clinical note
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Saved to this patient&apos;s clinical notes immediately (no AI draft). Operational
                  documentation only — follow your clinic charting standards.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="text-sm text-gray-500 hover:text-slate-200 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {err ? (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {err}
              </p>
            ) : null}

            <label className="mt-4 block">
              <span className="sr-only">Note text</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                maxLength={16000}
                disabled={pending}
                placeholder="Type clinical note…"
                data-testid="typed-note-textarea"
                className={cn(
                  "mt-1 w-full resize-y rounded-lg border border-white/[0.1] bg-[#020617] px-3 py-2 text-sm text-slate-100",
                  "placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/40",
                  "disabled:opacity-60"
                )}
              />
            </label>
            <p className="mt-1 text-right text-[10px] text-slate-500">{body.length} / 16000</p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="min-h-10 rounded-lg px-3 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending || !body.trim()}
                data-testid="typed-note-save"
                className="min-h-10 rounded-lg border border-violet-400/40 bg-violet-500/20 px-4 text-sm font-semibold text-violet-50 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
