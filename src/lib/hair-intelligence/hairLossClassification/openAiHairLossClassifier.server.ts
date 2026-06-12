import "server-only";

import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import { buildHairLossClassificationUserPrompt } from "./classificationPrompt";
import { parseHairLossClassificationModelJson } from "./modelHairLossJsonParse";
import type { HairLossClassificationModelResult } from "./types";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

export const HIE_HAIR_LOSS_CLASSIFIER_VERSION = "hie-hair-loss-classifier@1.0.0" as const;

function visionModel(): string {
  return (
    process.env.OPENAI_HAIR_LOSS_CLASSIFIER_MODEL?.trim() ||
    process.env.OPENAI_HAIR_IMAGE_CLASSIFIER_MODEL?.trim() ||
    process.env.OPENAI_CLINICAL_NOTE_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function requireOpenAiKey(): string {
  const k = process.env.OPENAI_API_KEY?.trim();
  if (!k) throw new Error("OPENAI_API_KEY is not configured.");
  return k;
}

/**
 * Calls OpenAI vision. Caller must supply a time-limited signed URL; do not log it.
 */
export async function classifyHairLossWithOpenAi(params: {
  imageUrlForModel: string;
}): Promise<{ result: HairLossClassificationModelResult; model: string }> {
  const key = requireOpenAiKey();
  const model = visionModel();
  const userPrompt = buildHairLossClassificationUserPrompt();

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
            "You are a hair restoration photography triage assistant. Output strict JSON only. Never diagnose disease.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: params.imageUrlForModel } },
          ],
        },
      ],
    }),
  });

  const rawJson = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(rawJson.error?.message?.trim() || `OpenAI vision HTTP ${res.status}`);
  }
  const content = rawJson.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned empty classification content.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON classification content.");
  }
  const shaped = parseHairLossClassificationModelJson(parsed);
  if (!shaped.ok) {
    throw new Error(`Classification JSON failed validation: ${shaped.error}`);
  }
  return { result: shaped.data, model };
}

export function isHairLossOpenAiConfigured(): boolean {
  return isOpenAiApiKeyConfigured();
}
