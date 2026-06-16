import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";

/** Parse a rules-based completion snapshot stored on a consultation row or form instance. */
export function parseConsultationCompletionSummaryFromUnknown(raw: unknown): ConsultationCompletionSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.consultationId !== "string" || typeof o.completedAt !== "string") return null;
  return o as unknown as ConsultationCompletionSummary;
}

export function parsePathwayCompletionFromConsultationStructured(structured: Record<string, unknown> | null | undefined): ConsultationCompletionSummary | null {
  if (!structured || typeof structured !== "object") return null;
  return parseConsultationCompletionSummaryFromUnknown(structured.completion_summary);
}
