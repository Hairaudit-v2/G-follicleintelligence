import "server-only";

import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import { buildConsultationChecklistUserPrompt } from "./checklistPrompt";
import { parseConsultationChecklistModelJson } from "./modelChecklistJsonParse";
import type { ConsultationChecklistModelResult } from "./types";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

export const HIE_CONSULTATION_CHECKLIST_GENERATOR_VERSION =
  "hie-consultation-checklist-generator@1.0.0" as const;

function textModel(): string {
  return (
    process.env.OPENAI_CONSULTATION_CHECKLIST_MODEL?.trim() ||
    process.env.OPENAI_CLINICAL_NOTE_MODEL?.trim() ||
    process.env.OPENAI_HAIR_LOSS_CLASSIFIER_MODEL?.trim() ||
    process.env.OPENAI_HAIR_IMAGE_CLASSIFIER_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function requireOpenAiKey(): string {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) throw new Error("OPENAI_API_KEY is not configured.");
  return k;
}

export async function generateConsultationChecklistWithOpenAi(params: {
  structuredContextJson: string;
}): Promise<{ result: ConsultationChecklistModelResult; model: string }> {
  const key = requireOpenAiKey();
  const model = textModel();
  const userPrompt = buildConsultationChecklistUserPrompt(params.structuredContextJson);

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You prepare structured consultation discussion checklists for licensed hair restoration clinicians. Output strict JSON only. Never recommend surgery, graft counts, hairlines, or outcomes.",
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const rawJson = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(rawJson.error?.message?.trim() || `OpenAI checklist HTTP ${res.status}`);
  }
  const content = rawJson.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned empty checklist content.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON checklist content.");
  }
  const shaped = parseConsultationChecklistModelJson(parsed);
  if (!shaped.ok) {
    throw new Error(`Consultation checklist JSON failed validation: ${shaped.error}`);
  }
  return { result: shaped.data, model };
}

export function isConsultationChecklistOpenAiConfigured(): boolean {
  return isOpenAiApiKeyConfigured();
}
