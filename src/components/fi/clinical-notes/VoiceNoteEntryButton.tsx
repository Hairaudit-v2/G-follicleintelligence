"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { approveClinicalVoiceNoteAction } from "@/lib/actions/fi-clinical-voice-note-actions";
import { CLINICAL_NOTE_SECTION_KEYS, CLINICAL_NOTE_SECTION_LABELS } from "@/src/lib/clinicalNotes/clinicalNoteConstants";
import type { ClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";

type ProcessOk = {
  ok: true;
  clinical_note: {
    id: string;
    record_status: string;
    sections: ClinicalNoteSections;
    transcript_raw: string;
    created_at: string;
    case_id: string | null;
  };
};

type ProcessErr = { ok: false; error?: string };

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return undefined;
}

export function VoiceNoteEntryButton({
  tenantId,
  patientId,
  caseId,
}: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ProcessOk["clinical_note"] | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const resetCapture = useCallback(() => {
    setRecordedBlob(null);
    setFile(null);
    chunksRef.current = [];
  }, []);

  const close = useCallback(() => {
    if (recording && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setOpen(false);
    setErr(null);
    setDraft(null);
    setRecording(false);
    resetCapture();
    setShowTranscript(false);
  }, [recording, resetCapture]);

  const startRecording = useCallback(async () => {
    setErr(null);
    resetCapture();
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        mediaRecorderRef.current = null;
        setRecording(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setErr("Microphone permission was denied or unavailable.");
    }
  }, [resetCapture]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
  }, []);

  const submitAudio = useCallback(() => {
    setErr(null);
    const blob = file ?? recordedBlob;
    if (!blob) {
      setErr("Choose a file or record audio first.");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("audio", blob, file?.name?.trim() || "voice-note.webm");
        if (caseId?.trim()) fd.append("caseId", caseId.trim());
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId.trim())}/patients/${encodeURIComponent(
            patientId.trim()
          )}/voice-notes/process`,
          { method: "POST", body: fd }
        );
        const json = (await res.json().catch(() => ({}))) as ProcessOk | ProcessErr;
        if (!res.ok || !json || (json as ProcessErr).ok === false) {
          const msg = (json as ProcessErr).error ?? `Request failed (${res.status})`;
          setErr(msg);
          return;
        }
        const ok = json as ProcessOk;
        setDraft(ok.clinical_note);
        router.refresh();
      } catch {
        setErr("Network error while processing audio.");
      }
    });
  }, [caseId, file, patientId, recordedBlob, router, tenantId]);

  const approve = useCallback(() => {
    if (!draft) return;
    setErr(null);
    startTransition(async () => {
      const res = await approveClinicalVoiceNoteAction({
        tenantId: tenantId.trim(),
        clinicalNoteId: draft.id,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      close();
    });
  }, [close, draft, router, tenantId]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
          setDraft(null);
          resetCapture();
        }}
        className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-950 hover:bg-violet-100"
      >
        Voice note
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-note-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="voice-note-dialog-title" className="text-base font-semibold text-gray-900">
                  Voice-to-note (consultation)
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Audio is transcribed and structured by AI. The result is saved as an <strong>AI draft</strong> — review
                  and approve before it becomes part of the official record. The original transcript is stored separately
                  from the approved structured note.
                </p>
              </div>
              <button type="button" onClick={close} className="text-sm text-gray-500 hover:text-gray-800">
                Close
              </button>
            </div>

            {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}

            {!draft ? (
              <div className="mt-4 space-y-4">
                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700">Upload audio</p>
                  <input
                    type="file"
                    accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg"
                    className="mt-2 block w-full text-sm"
                    disabled={pending || recording}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f) setRecordedBlob(null);
                    }}
                  />
                </div>

                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700">Or record in browser</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!recording ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={startRecording}
                        className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        Start recording
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                  {recordedBlob && !file ? (
                    <p className="mt-2 text-xs text-emerald-800">Recording ready ({Math.round(recordedBlob.size / 1024)} KB).</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={pending || recording}
                  onClick={submitAudio}
                  className="rounded bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:bg-gray-400"
                >
                  {pending ? "Transcribing & structuring…" : "Generate draft note"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Status: <strong>{draft.record_status}</strong> — this note is not official until you approve below.
                </p>

                <div className="space-y-3">
                  {CLINICAL_NOTE_SECTION_KEYS.map((key) => (
                    <div key={key}>
                      <h3 className="text-xs font-semibold text-gray-800">{CLINICAL_NOTE_SECTION_LABELS[key]}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                        {draft.sections[key]?.trim() || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  className="text-xs font-medium text-violet-800 hover:underline"
                >
                  {showTranscript ? "Hide" : "Show"} original transcript (separate from approved record)
                </button>
                {showTranscript ? (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-800">
                    {draft.transcript_raw}
                  </pre>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={approve}
                    className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-gray-400"
                  >
                    {pending ? "Saving…" : "Approve official record"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setDraft(null);
                      resetCapture();
                    }}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
                  >
                    New capture
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
