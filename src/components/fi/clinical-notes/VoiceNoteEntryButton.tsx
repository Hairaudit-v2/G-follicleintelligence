"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { approveClinicalVoiceNoteAction } from "@/lib/actions/fi-clinical-voice-note-actions";
import {
  CLINICAL_NOTE_SECTION_KEYS,
  CLINICAL_NOTE_SECTION_LABELS,
} from "@/src/lib/clinicalNotes/clinicalNoteConstants";
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
    consultation_id?: string | null;
  };
};

type ProcessErr = { ok: false; error?: string };

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return undefined;
}

/** Map getUserMedia / MediaRecorder failures to actionable clinic-facing copy. */
function formatMicrophoneAccessError(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: string }).name ?? "")
      : "";
  const message =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "")
        : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return [
      "Microphone blocked by the browser or Windows.",
      "Edge: click the lock icon in the address bar → Permissions for this site → Microphone → Allow, then reload.",
      "Also check Windows Settings → Privacy & security → Microphone (access On, and allow Microsoft Edge).",
      "You can still use Upload audio below without the mic.",
    ].join(" ");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Plug in a mic/headset, set it as the default input in Windows Sound settings, then try again — or use Upload audio.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Microphone is busy or locked by another app (Zoom, Teams, etc.). Close those apps and retry, or use Upload audio.";
  }
  if (name === "SecurityError") {
    return "Microphone requires a secure page (https). Open the production site over https and try again.";
  }
  if (name === "NotSupportedError" || typeof MediaRecorder === "undefined") {
    return "This browser cannot record audio in-page. Use Upload audio (phone voice memo / Windows Voice Recorder .m4a/.mp3/.wav) instead.";
  }
  const detail = [name, message].filter(Boolean).join(": ");
  return detail
    ? `Microphone unavailable (${detail}). Try Upload audio, or check Edge/Windows mic permissions.`
    : "Microphone permission was denied or unavailable. Try Upload audio, or allow the mic for this site in Edge and Windows Settings.";
}

export function VoiceNoteEntryButton({
  tenantId,
  patientId,
  caseId,
  consultationId,
  label = "Voice note",
  className,
  onDraftCreated,
}: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  /** Links the draft clinical note to this consultation when set. */
  consultationId?: string | null;
  label?: string;
  className?: string;
  onDraftCreated?: (note: ProcessOk["clinical_note"]) => void;
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
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setErr(
        "Microphone needs a secure context (https or localhost). Open the site via https:// and try again."
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(
        "Recording is not supported in this browser. Use Upload audio instead (phone memo or Windows Voice Recorder)."
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setErr(
        "MediaRecorder is not available in this browser. Use Upload audio instead."
      );
      return;
    }
    try {
      // Prefer Permissions API when available (helps surface Edge pre-block state).
      try {
        const perm = await navigator.permissions?.query?.({
          name: "microphone" as PermissionName,
        });
        if (perm?.state === "denied") {
          setErr(formatMicrophoneAccessError({ name: "NotAllowedError", message: "permission denied" }));
          return;
        }
      } catch {
        /* permissions.query('microphone') not supported in all Edge builds — continue to getUserMedia */
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mime = pickRecorderMime();
      let mr: MediaRecorder;
      try {
        mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      } catch {
        // Edge sometimes rejects a mimeType even when isTypeSupported is true.
        mr = new MediaRecorder(stream);
      }
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || mime || "audio/webm",
        });
        setRecordedBlob(blob);
        mediaRecorderRef.current = null;
        setRecording(false);
      };
      mr.onerror = () => {
        setErr("Recording failed mid-capture. Try Upload audio instead.");
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      mediaRecorderRef.current = mr;
      mr.start(250);
      setRecording(true);
    } catch (e) {
      setErr(formatMicrophoneAccessError(e));
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
        if (consultationId?.trim()) fd.append("consultationId", consultationId.trim());
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
        onDraftCreated?.(ok.clinical_note);
        router.refresh();
      } catch {
        setErr("Network error while processing audio.");
      }
    });
  }, [caseId, consultationId, file, onDraftCreated, patientId, recordedBlob, router, tenantId]);

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
        className={
          className ??
          "rounded border border-violet-300 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/15"
        }
      >
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-note-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="voice-note-dialog-title" className="text-base font-semibold text-slate-100">
                  Voice-to-note (consultation)
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Audio is transcribed and structured by AI. The result is saved as an{" "}
                  <strong>AI draft</strong> — review and approve before it becomes part of the
                  official record. The original transcript is stored separately from the approved
                  structured note.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-sm text-gray-500 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            {err ? <p className="mt-3 text-sm text-rose-300">{err}</p> : null}

            {!draft ? (
              <div className="mt-4 space-y-4">
                <div className="rounded border border-cyan-500/25 bg-cyan-950/25 p-3">
                  <p className="text-xs font-semibold text-cyan-100">
                    Recommended if the mic is blocked: Upload audio
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Record on your phone (Voice Memos) or Windows Voice Recorder, then upload
                    .m4a / .mp3 / .wav / .webm here. No browser mic permission needed.
                  </p>
                  <input
                    type="file"
                    accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg,.mp4"
                    className="mt-2 block w-full text-sm text-slate-200"
                    disabled={pending || recording}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f) setRecordedBlob(null);
                    }}
                  />
                  {file ? (
                    <p className="mt-2 text-xs text-emerald-300">
                      Ready: {file.name} ({Math.round(file.size / 1024)} KB)
                    </p>
                  ) : null}
                </div>

                <div className="rounded border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-xs font-medium text-slate-300">Or record in this browser</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Edge must allow Microphone for this site, and Windows Privacy must allow Edge
                    to use the mic. InPrivate does not reset a previously blocked site permission
                    in all cases — reset it under the lock icon or edge://settings/content/microphone
                  </p>
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
                    <p className="mt-2 text-xs text-emerald-300">
                      Recording ready ({Math.round(recordedBlob.size / 1024)} KB).
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={pending || recording || (!file && !recordedBlob)}
                  onClick={submitAudio}
                  className="rounded bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:bg-gray-400"
                >
                  {pending ? "Transcribing & structuring…" : "Generate draft note"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                  Status: <strong>{draft.record_status}</strong> — this note is not official until
                  you approve below.
                </p>

                <div className="space-y-3">
                  {CLINICAL_NOTE_SECTION_KEYS.map((key) => (
                    <div key={key}>
                      <h3 className="text-xs font-semibold text-slate-200">
                        {CLINICAL_NOTE_SECTION_LABELS[key]}
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                        {draft.sections[key]?.trim() || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  className="text-xs font-medium text-violet-300 hover:underline"
                >
                  {showTranscript ? "Hide" : "Show"} original transcript (separate from approved
                  record)
                </button>
                {showTranscript ? (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-white/[0.08] bg-white/[0.03] p-2 text-xs text-slate-200">
                    {draft.transcript_raw}
                  </pre>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
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
                    className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.03]"
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
