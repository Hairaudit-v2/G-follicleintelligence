/**
 * ConsultationOS Stage 3 — voice_note / clinical_note field values stored in form instance JSONB.
 */

export type VoiceNoteFieldValue = {
  mode: "voice_note";
  transcript: string;
  clinicalNoteId?: string | null;
  updatedAt?: string;
};

export type ClinicalNoteFieldValue = {
  mode: "clinical_note";
  note: string;
  updatedAt?: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeVoiceNoteValue(raw: unknown): VoiceNoteFieldValue {
  if (typeof raw === "string") {
    return { mode: "voice_note", transcript: raw, updatedAt: nowIso() };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { mode: "voice_note", transcript: "", updatedAt: nowIso() };
  }
  const o = raw as Record<string, unknown>;
  const transcript = typeof o.transcript === "string" ? o.transcript : "";
  const clinicalNoteId =
    typeof o.clinicalNoteId === "string" && o.clinicalNoteId.trim()
      ? o.clinicalNoteId.trim()
      : null;
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : nowIso();
  return { mode: "voice_note", transcript, clinicalNoteId, updatedAt };
}

export function normalizeClinicalNoteValue(raw: unknown): ClinicalNoteFieldValue {
  if (typeof raw === "string") {
    return { mode: "clinical_note", note: raw, updatedAt: nowIso() };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { mode: "clinical_note", note: "", updatedAt: nowIso() };
  }
  const o = raw as Record<string, unknown>;
  const note = typeof o.note === "string" ? o.note : "";
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : nowIso();
  return { mode: "clinical_note", note, updatedAt };
}

export function getVoiceNoteTranscript(raw: unknown): string {
  return normalizeVoiceNoteValue(raw).transcript;
}

export function getClinicalNoteText(raw: unknown): string {
  return normalizeClinicalNoteValue(raw).note;
}

/** Acceptable for submit when the field has a value: object with string transcript (or nullish). */
export function isValidVoiceNoteValueShape(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") return true;
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if ("transcript" in o && typeof o.transcript !== "string") return false;
  if ("clinicalNoteId" in o && o.clinicalNoteId != null && typeof o.clinicalNoteId !== "string")
    return false;
  if ("mode" in o && o.mode !== undefined && o.mode !== "voice_note") return false;
  return true;
}

export function isValidClinicalNoteValueShape(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") return true;
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if ("note" in o && typeof o.note !== "string") return false;
  if ("mode" in o && o.mode !== undefined && o.mode !== "clinical_note") return false;
  return true;
}
