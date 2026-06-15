"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { upsertConsultationFormClinicalNoteAction } from "@/lib/actions/fi-consultation-form-actions";
import { cn } from "@/lib/utils";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import type { ConsultationFormPersistenceContext } from "@/src/lib/consultationForms/consultationFormTypes";
import {
  normalizeVoiceNoteValue,
  nowIso,
  type VoiceNoteFieldValue,
} from "@/src/lib/consultationForms/consultationFormNoteModel";

/** Subset of Web Speech API used here (DOM lib typings vary by TypeScript version). */
type BrowserSpeechRecognitionResult = { transcript: string };
type BrowserSpeechRecognitionResultList = ArrayLike<{ 0: BrowserSpeechRecognitionResult }>;
type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onresult: ((ev: BrowserSpeechRecognitionEvent) => void) | null;
};

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceNoteField({
  fieldId,
  label,
  description,
  required,
  value,
  onChange,
  disabled,
  persistence,
}: {
  fieldId: string;
  label: string;
  description?: string | null;
  required?: boolean;
  value: unknown;
  onChange: (next: VoiceNoteFieldValue) => void;
  disabled: boolean;
  persistence: ConsultationFormPersistenceContext | null;
}) {
  const normalized = useMemo(() => normalizeVoiceNoteValue(value), [value]);
  const [transcript, setTranscript] = useState(normalized.transcript);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setTranscript(normalized.transcript);
  }, [normalized.transcript]);

  const commitTranscript = useCallback(
    (next: string) => {
      setTranscript(next);
      const nid = normalizeVoiceNoteValue(valueRef.current).clinicalNoteId;
      onChange({
        mode: "voice_note",
        transcript: next,
        clinicalNoteId: nid ?? undefined,
        updatedAt: nowIso(),
      });
    },
    [onChange]
  );

  const stopDictation = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const startDictation = useCallback(() => {
    setSpeechError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechError("Speech recognition is not available in this browser.");
      return;
    }
    stopDictation();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    rec.onerror = (ev) => {
      setSpeechError(ev.error === "not-allowed" ? "Microphone access denied." : `Speech error: ${ev.error}`);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        chunk += event.results[i]?.[0]?.transcript ?? "";
      }
      if (!chunk.trim()) return;
      setTranscript((prev) => {
        const sep = prev.trim().length > 0 && !prev.endsWith(" ") ? " " : "";
        const merged = `${prev}${sep}${chunk}`.trimStart();
        const nid = normalizeVoiceNoteValue(valueRef.current).clinicalNoteId;
        onChange({
          mode: "voice_note",
          transcript: merged,
          clinicalNoteId: nid ?? undefined,
          updatedAt: nowIso(),
        });
        return merged;
      });
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setSpeechError(e instanceof Error ? e.message : "Could not start dictation.");
      setListening(false);
    }
  }, [onChange, stopDictation]);

  useEffect(
    () => () => {
      stopDictation();
    },
    [stopDictation]
  );

  const hasSpeech = typeof window !== "undefined" && Boolean(getSpeechRecognitionCtor());

  const onSaveToClinicalNotes = useCallback(async () => {
    if (!persistence?.patientId?.trim()) {
      setSaveStatus("error");
      setSaveMessage("Link a patient on the consultation to save clinical notes.");
      return;
    }
    setSaveStatus("saving");
    setSaveMessage(null);
    const existing = normalizeVoiceNoteValue(valueRef.current).clinicalNoteId ?? null;
    const res = await upsertConsultationFormClinicalNoteAction(persistence.tenantId, persistence.consultationId, {
      formInstanceId: persistence.formInstanceId,
      formFieldId: fieldId,
      transcriptRaw: transcript,
      clinicalNoteId: existing,
    });
    if (!res.ok) {
      setSaveStatus("error");
      setSaveMessage(res.error);
      return;
    }
    setSaveStatus("saved");
    setSaveMessage("Saved to clinical notes.");
    onChange({
      mode: "voice_note",
      transcript,
      clinicalNoteId: res.clinicalNoteId,
      updatedAt: nowIso(),
    });
  }, [fieldId, onChange, persistence, transcript]);

  return (
    <div className="space-y-2">
      <div>
        <div className={fiOsLightFormSurfaceClassNames.labelInline}>
          {label}
          {required ? <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span> : null}
        </div>
        {description?.trim() ? (
          <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
        ) : null}
      </div>
      <p className={fiOsLightFormSurfaceClassNames.helper}>
        Dictation availability depends on browser/device support. Use the text area if speech is unavailable.
      </p>
      {!disabled && hasSpeech ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (listening ? stopDictation() : startDictation())}
            className={cn(
              "min-h-[44px] touch-manipulation rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition",
              listening
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-sky-600 text-white hover:bg-sky-700"
            )}
          >
            {listening ? "Stop dictation" : "Start dictation"}
          </button>
          <button
            type="button"
            onClick={() => {
              stopDictation();
              commitTranscript("");
            }}
            className="min-h-[44px] touch-manipulation rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/50"
          >
            Clear transcript
          </button>
        </div>
      ) : null}
      {listening ? (
        <FiCard className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          Dictation active — speak clearly. Tap “Stop dictation” when finished.
        </FiCard>
      ) : null}
      {speechError?.trim() ? (
        <p className="text-xs text-red-800" role="alert">
          {speechError}
        </p>
      ) : null}
      <textarea
        className={cn(
          "min-h-[160px] w-full",
          fiOsLightFormSurfaceClassNames.controlInset,
          disabled && "opacity-80"
        )}
        value={transcript}
        disabled={disabled}
        onChange={(e) => commitTranscript(e.target.value)}
        placeholder="Type or dictate consultation notes here…"
      />
      {!disabled ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void onSaveToClinicalNotes()}
            disabled={saveStatus === "saving" || !transcript.trim()}
            className="min-h-[44px] touch-manipulation rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Saving…" : "Save to clinical notes"}
          </button>
          {normalized.clinicalNoteId?.trim() ? (
            <span className={fiOsLightFormSurfaceClassNames.meta}>Linked note ID: {normalized.clinicalNoteId.slice(0, 8)}…</span>
          ) : null}
        </div>
      ) : null}
      {saveStatus === "saved" && saveMessage?.trim() ? (
        <p className="text-xs font-medium text-emerald-800" role="status">
          {saveMessage}
        </p>
      ) : null}
      {saveStatus === "error" && saveMessage?.trim() ? (
        <p className="text-xs font-medium text-red-800" role="alert">
          {saveMessage}
        </p>
      ) : null}
    </div>
  );
}

export function VoiceNoteReadOnlySummary({ label, value }: { label: string; value: unknown }) {
  const { transcript, clinicalNoteId } = normalizeVoiceNoteValue(value);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-800">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-slate-700">{transcript.trim() || "—"}</p>
      {clinicalNoteId?.trim() ? (
        <p className={cn("mt-2", fiOsLightFormSurfaceClassNames.meta)}>Clinical note: {clinicalNoteId}</p>
      ) : null}
    </div>
  );
}
