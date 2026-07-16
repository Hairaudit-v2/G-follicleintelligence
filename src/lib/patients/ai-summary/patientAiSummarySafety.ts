/**
 * Safety layer for AI Patient Summary — keyword guardrails + template bounds.
 * Operational only; rejects clinical advice language.
 */

import type { PatientAiSummaryLlmPayload, PatientAiSummaryResult } from "./patientAiSummaryTypes";
import { PATIENT_AI_SUMMARY_DISCLAIMER } from "./patientAiSummaryTypes";

/** Phrases that must never appear in model output (case-insensitive). */
export const PATIENT_AI_SUMMARY_BLOCKED_PHRASES = [
  "you should prescribe",
  "i recommend treating",
  "diagnosed with",
  "diagnosis is",
  "treatment plan",
  "start finasteride",
  "start minoxidil",
  "dosage",
  "mg/day",
  "clinical recommendation",
  "you have androgenetic",
  "likely to regrow",
  "prognosis",
  "guaranteed results",
  "will regrow",
  "medication advice",
  "change your dose",
] as const;

/** Soft markers that trigger human-review flag (still may show after strip). */
export const PATIENT_AI_SUMMARY_REVIEW_MARKERS = [
  "suggest treatment",
  "consider prescribing",
  "pathology shows",
  "bloods indicate",
  "cancer",
  "suicide",
  "self-harm",
] as const;

export function textContainsBlockedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of PATIENT_AI_SUMMARY_BLOCKED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

export function textNeedsHumanReview(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of PATIENT_AI_SUMMARY_REVIEW_MARKERS) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

export function joinSummaryTextForScan(payload: PatientAiSummaryLlmPayload): string {
  const parts = [
    payload.overview,
    ...payload.suggestedNextSteps,
    ...payload.operationalFlags.map((f) => `${f.label} ${f.code}`),
    ...payload.timelineHighlights.map((t) => `${t.label} ${t.kind}`),
  ];
  return parts.join("\n");
}

export type SafetyCheckResult = {
  ok: boolean;
  requiresHumanReview: boolean;
  notes: string[];
  /** When blocked, use deterministic fallback instead. */
  blocked: boolean;
};

export function checkPatientAiSummarySafety(payload: PatientAiSummaryLlmPayload): SafetyCheckResult {
  const notes: string[] = [];
  const blob = joinSummaryTextForScan(payload);
  const blocked = textContainsBlockedPhrase(blob);
  if (blocked) {
    notes.push(`Blocked phrase detected: “${blocked}”. Falling back to operational template.`);
    return { ok: false, requiresHumanReview: true, notes, blocked: true };
  }
  const review = textNeedsHumanReview(blob);
  if (review) {
    notes.push(`Human review suggested (marker: “${review}”).`);
    return { ok: true, requiresHumanReview: true, notes, blocked: false };
  }
  // Bound lengths (audit / UI safety)
  if (payload.overview.length > 1200) {
    notes.push("Overview truncated for display safety.");
    payload.overview = payload.overview.slice(0, 1199).trimEnd() + "…";
  }
  if (payload.suggestedNextSteps.length > 6) {
    payload.suggestedNextSteps = payload.suggestedNextSteps.slice(0, 6);
    notes.push("Next steps capped at 6.");
  }
  return { ok: true, requiresHumanReview: false, notes, blocked: false };
}

export function assertResultDisclaimer(result: PatientAiSummaryResult): PatientAiSummaryResult {
  return {
    ...result,
    disclaimer: PATIENT_AI_SUMMARY_DISCLAIMER,
  };
}
