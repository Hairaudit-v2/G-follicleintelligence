import type { FiAiImageClassificationResult } from "./types";

export function hairImageClassificationNotConfiguredResult(): FiAiImageClassificationResult {
  return {
    category: "unknown",
    categoryConfidence: 0,
    hairState: "unknown",
    shaveState: "unknown",
    surgeryStage: "unknown",
    notes: "AI classification is not configured (OPENAI_API_KEY missing).",
  };
}

export function isOpenAiApiKeyConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
