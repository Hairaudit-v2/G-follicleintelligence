/**
 * SpaceXAI (xAI) client for AI Patient Summary — server-only.
 * OpenAI-compatible chat completions at api.x.ai.
 */

import "server-only";

import {
  buildPatientAiSummaryUserPrompt,
  PATIENT_AI_SUMMARY_SYSTEM_PROMPT,
} from "./patientAiSummaryPrompt";
import type { PatientAiSummaryFacts } from "./patientAiSummaryTypes";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
/** Default model — override via PATIENT_AI_SUMMARY_MODEL. */
export const PATIENT_AI_SUMMARY_DEFAULT_MODEL = "grok-4-1-fast-non-reasoning";

export function isPatientAiSummaryLlmConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export function resolvePatientAiSummaryModel(): string {
  return (
    process.env.PATIENT_AI_SUMMARY_MODEL?.trim() ||
    process.env.XAI_MODEL?.trim() ||
    PATIENT_AI_SUMMARY_DEFAULT_MODEL
  );
}

export async function callPatientAiSummaryLlm(
  facts: PatientAiSummaryFacts
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "XAI_API_KEY is not configured." };
  }
  const model = resolvePatientAiSummaryModel();

  try {
    const res = await fetch(XAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: PATIENT_AI_SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: buildPatientAiSummaryUserPrompt(facts) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `xAI error ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "Empty model response." };
    return { ok: true, text, model };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "xAI request failed.",
    };
  }
}
