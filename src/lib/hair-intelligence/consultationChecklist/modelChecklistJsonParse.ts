import { z } from "zod";
import {
  clampConsultationChecklistConfidence,
  normalizeHieConsultationConsentComplexity,
  normalizeHieConsultationPriorityLevel,
} from "./enumValidation";
import type { ConsultationChecklistModelResult } from "./types";

const rawSchema = z.object({
  confidence_score: z.number(),
  priority_level: z.string(),
  medication_discussion_required: z.boolean(),
  stabilisation_discussion_required: z.boolean(),
  donor_preservation_discussion_required: z.boolean(),
  expectation_management_required: z.boolean(),
  consent_complexity_level: z.union([z.string(), z.null()]).optional(),
  documentation_required: z.boolean(),
  follow_up_required: z.boolean(),
  delay_recommended: z.boolean(),
  checklist_items: z.array(z.unknown()),
  risk_flags: z.array(z.unknown()),
  consultation_summary: z.string(),
  ai_notes: z.string(),
});

export type ConsultationChecklistModelJsonParseSuccess = {
  ok: true;
  data: ConsultationChecklistModelResult;
};
export type ConsultationChecklistModelJsonParseFailure = { ok: false; error: string };

function sliceText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function normalizeStringArray(raw: unknown[], maxItems: number, maxLen: number): string[] {
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    out.push(t.slice(0, maxLen));
    if (out.length >= maxItems) break;
  }
  return out;
}

export function parseConsultationChecklistModelJson(
  parsed: unknown
): ConsultationChecklistModelJsonParseSuccess | ConsultationChecklistModelJsonParseFailure {
  const zod = rawSchema.safeParse(parsed);
  if (!zod.success) {
    return { ok: false, error: zod.error.issues[0]?.message ?? "invalid json" };
  }
  const d = zod.data;
  const consent = normalizeHieConsultationConsentComplexity(d.consent_complexity_level ?? null);
  const out: ConsultationChecklistModelResult = {
    confidence_score: clampConsultationChecklistConfidence(d.confidence_score),
    priority_level: normalizeHieConsultationPriorityLevel(d.priority_level),
    medication_discussion_required: Boolean(d.medication_discussion_required),
    stabilisation_discussion_required: Boolean(d.stabilisation_discussion_required),
    donor_preservation_discussion_required: Boolean(d.donor_preservation_discussion_required),
    expectation_management_required: Boolean(d.expectation_management_required),
    consent_complexity_level: consent,
    documentation_required: Boolean(d.documentation_required),
    follow_up_required: Boolean(d.follow_up_required),
    delay_recommended: Boolean(d.delay_recommended),
    checklist_items: normalizeStringArray(d.checklist_items, 60, 500),
    risk_flags: normalizeStringArray(d.risk_flags, 40, 240),
    consultation_summary: sliceText(
      typeof d.consultation_summary === "string" ? d.consultation_summary : "",
      8000
    ),
    ai_notes: sliceText(typeof d.ai_notes === "string" ? d.ai_notes : "", 8000),
  };
  return { ok: true, data: out };
}
