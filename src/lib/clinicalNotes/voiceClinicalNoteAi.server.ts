import "server-only";

import { CLINICAL_NOTE_SECTION_KEYS } from "@/src/lib/clinicalNotes/clinicalNoteConstants";
import type { ClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";
import { parseClinicalNoteSections } from "@/src/lib/clinicalNotes/clinicalNoteSchemas";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

function requireOpenAiKey(): string {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) {
    throw new Error("OPENAI_API_KEY is not configured for voice-to-note.");
  }
  return k;
}

export async function transcribeAudioWithOpenAIWhisper(params: {
  audio: Blob;
  filename: string;
}): Promise<string> {
  const key = requireOpenAiKey();
  const form = new FormData();
  form.append("file", params.audio, params.filename || "audio.webm");
  form.append("model", "whisper-1");
  form.append("response_format", "json");

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(body.error?.message?.trim() || `Whisper HTTP ${res.status}`);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  return text;
}

function sectionsJsonPrompt(): string {
  const lines = CLINICAL_NOTE_SECTION_KEYS.map((k) => `  "${k}": "string"`).join(",\n");
  return `{\n${lines}\n}`;
}

/**
 * Converts a raw transcript into the fixed section object using OpenAI chat JSON mode.
 */
export async function structureTranscriptWithOpenAI(params: {
  transcript: string;
}): Promise<{ sections: ClinicalNoteSections; model: string }> {
  const key = requireOpenAiKey();
  const model = process.env.OPENAI_CLINICAL_NOTE_MODEL?.trim() || "gpt-4o-mini";

  const keysList = CLINICAL_NOTE_SECTION_KEYS.join(", ");
  const system = [
    "You are a clinical documentation assistant for hair-loss / trichology consultations in a licensed clinic context.",
    "Given a transcript (may be imperfect), produce structured clinical note sections.",
    "Use professional clinical language. Do not invent facts: if the transcript does not cover a section, return an empty string for that key.",
    "Do not include disclaimers or meta-commentary.",
    `Respond with a single JSON object only (no markdown) with exactly these string keys: ${keysList}.`,
    "Example shape (values must be replaced): " + sectionsJsonPrompt(),
  ].join(" ");

  const user = `Transcript:\n\n${params.transcript}`;

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const raw = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(raw.error?.message?.trim() || `OpenAI chat HTTP ${res.status}`);
  }
  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned an empty structured response.");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content) as unknown;
  } catch {
    throw new Error("OpenAI returned non-JSON content.");
  }
  const sections = parseClinicalNoteSections(parsedJson);
  return { sections, model };
}
