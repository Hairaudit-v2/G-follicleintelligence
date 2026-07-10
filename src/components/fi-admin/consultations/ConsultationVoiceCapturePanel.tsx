"use client";

import Link from "next/link";

import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import { FiCard } from "@/src/components/fi-design/FiCard";

/**
 * In-room voice capture for ConsultationOS hubs.
 * Reuses DoctorOS voice → Whisper → structured clinical note pipeline.
 */
export function ConsultationVoiceCapturePanel({
  tenantId,
  consultationId,
  patientId,
  caseId,
  canEdit,
}: {
  tenantId: string;
  consultationId: string;
  patientId: string | null;
  caseId?: string | null;
  canEdit: boolean;
}) {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  const pid = patientId?.trim() || null;

  return (
    <FiCard
      className="border-violet-500/25 bg-gradient-to-br from-violet-950/30 via-[#0F1629]/50 to-[#0F1629]/40 p-4 sm:p-5"
      data-testid="consultation-voice-capture-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
            During consultation
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-50">Voice to clinical note</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Record the consult (or upload audio). AI transcribes and structures a draft clinical
            note (presenting concern, history, exam, plan, etc.). Approve the draft when ready.
            Open a guided pathway form and use <strong className="font-medium text-slate-300">Apply
            voice note to form</strong> to fill matching text fields.
          </p>
        </div>
        {canEdit && pid ? (
          <VoiceNoteEntryButton
            tenantId={tid}
            patientId={pid}
            caseId={caseId}
            consultationId={cid}
            label="Record / voice note"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-400/40 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
          />
        ) : null}
      </div>

      {!pid ? (
        <p
          className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          Link a <strong className="font-medium">patient</strong> on this consultation first — voice
          notes are stored on the patient chart.
        </p>
      ) : !canEdit ? (
        <p className="mt-3 text-xs text-slate-500">
          This consultation is not editable — open the patient chart to review voice notes.
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Requires <code className="text-slate-400">OPENAI_API_KEY</code> on the server (Whisper +
          structure model). Optional{" "}
          <code className="text-slate-400">OPENAI_CLINICAL_NOTE_MODEL</code> (default gpt-4o-mini).{" "}
          <Link
            href={`/fi-admin/${tid}/patients/${encodeURIComponent(pid)}`}
            className="text-violet-300 hover:text-violet-200"
          >
            View patient notes
          </Link>
        </p>
      )}
    </FiCard>
  );
}
