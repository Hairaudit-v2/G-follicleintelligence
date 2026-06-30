import "server-only";

import { z } from "zod";
import { buildHairRestorationImageClassificationUserPrompt } from "./classificationPrompt";
import {
  clampConfidence,
  normalizeFiAiHairState,
  normalizeFiAiImageCategory,
  normalizeFiAiShaveState,
  normalizeFiAiSurgeryStage,
} from "./enumValidation";
import type { FiAiImageClassificationResult } from "./types";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

const openAiVisionResponseSchema = z.object({
  category: z.string(),
  category_confidence: z.number(),
  hair_state: z.string(),
  shave_state: z.string(),
  surgery_stage: z.string(),
  notes: z.string(),
});

export const HLI_IMAGE_CLASSIFIER_VERSION = "hli-image-classifier@1.0.0" as const;

function visionModel(): string {
  return (
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

function shapeOpenAiResult(
  raw: z.infer<typeof openAiVisionResponseSchema>
): FiAiImageClassificationResult {
  return {
    category: normalizeFiAiImageCategory(raw.category),
    categoryConfidence: clampConfidence(raw.category_confidence),
    hairState: normalizeFiAiHairState(raw.hair_state),
    shaveState: normalizeFiAiShaveState(raw.shave_state),
    surgeryStage: normalizeFiAiSurgeryStage(raw.surgery_stage),
    notes: typeof raw.notes === "string" ? raw.notes.trim().slice(0, 2000) : "",
  };
}

/**
 * Calls OpenAI vision chat completions. Caller must supply a time-limited URL; do not log it.
 */
export async function classifyHairRestorationImageWithOpenAi(params: {
  imageUrlForModel: string;
}): Promise<{ result: FiAiImageClassificationResult; model: string }> {
  const key = requireOpenAiKey();
  const model = visionModel();
  const userPrompt = buildHairRestorationImageClassificationUserPrompt();

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
            "You are a clinical photography triage assistant for hair restoration. Output strict JSON only. Never diagnose disease.",
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
  const zod = openAiVisionResponseSchema.safeParse(parsed);
  if (!zod.success) {
    throw new Error(
      `Classification JSON failed validation: ${zod.error.issues[0]?.message ?? "invalid"}`
    );
  }
  return { result: shapeOpenAiResult(zod.data), model };
}
