import type {
  ConsultationCompletionSummary,
  ConsultationOutcomeType,
} from "../completion/consultationCompletionTypes";
import type { PathologyTemplateId } from "@/src/lib/pathology/pathologyTypes";

/** CRM task title from guided consultation outcome (Stage 5A). */
export function followUpTaskTitleForOutcome(outcomeType: ConsultationOutcomeType): string {
  switch (outcomeType) {
    case "needs_blood_tests":
      return "Follow up blood test request";
    case "proceed_surgery":
      return "Follow up surgery plan";
    case "review_later":
      return "Review consultation plan";
    case "undecided":
      return "Follow up undecided consultation";
    default:
      return "Follow up consultation";
  }
}

export function followUpTaskRecommended(summary: ConsultationCompletionSummary): boolean {
  if (summary.followUpRequired) return true;
  return (
    summary.outcomeType === "review_later" ||
    summary.outcomeType === "undecided" ||
    summary.outcomeType === "needs_blood_tests"
  );
}

export function buildFollowUpTaskDescription(summary: ConsultationCompletionSummary): string {
  const parts: string[] = [];
  if (summary.followUpReason.trim()) parts.push(`Follow-up: ${summary.followUpReason.trim()}`);
  if (summary.recommendedProcedure.trim()) parts.push(`Plan: ${summary.recommendedProcedure.trim()}`);
  if (summary.quoteNotes.trim()) parts.push(`Quote notes: ${summary.quoteNotes.trim()}`);
  return parts.join("\n\n").trim() || "Follow up from guided consultation completion.";
}

/** Plain text for quote draft body (Stage 5B) — stored in CRM quote metadata / line snapshot. */
export function buildQuoteDraftNotesText(summary: ConsultationCompletionSummary): string {
  const lines: string[] = [];
  if (summary.quoteNotes.trim()) lines.push(summary.quoteNotes.trim());
  const graft =
    summary.estimatedGraftsMin != null && summary.estimatedGraftsMax != null
      ? `Estimated grafts: ${summary.estimatedGraftsMin}–${summary.estimatedGraftsMax}`
      : null;
  if (graft) lines.push(graft);
  if (summary.recommendedTreatments.length) {
    lines.push(`Recommended treatments: ${summary.recommendedTreatments.join(", ")}`);
  }
  if (summary.recommendedZones.length) {
    lines.push(`Zones: ${summary.recommendedZones.join(", ")}`);
  }
  if (summary.diagnosisImpression.trim()) lines.push(`Diagnosis: ${summary.diagnosisImpression.trim()}`);
  return lines.join("\n\n").trim() || "Consultation quote draft.";
}

export function quoteDraftTitle(summary: ConsultationCompletionSummary): string {
  const t = summary.recommendedProcedure.trim();
  return t ? t.slice(0, 200) : "Consultation treatment plan";
}

export function pathologyTemplateForOutcome(outcomeType: ConsultationOutcomeType): PathologyTemplateId {
  if (outcomeType === "proceed_surgery") return "hair_transplant_pre_op";
  if (outcomeType === "medical_management" || outcomeType === "needs_blood_tests") return "hair_loss_investigation";
  return "custom_request";
}

export function pathologyHandoffRecommended(summary: ConsultationCompletionSummary): boolean {
  return summary.pathologyRecommended;
}

export function surgeryPlanningHandoffEligible(summary: ConsultationCompletionSummary, caseId: string | null): boolean {
  if (!caseId?.trim()) return false;
  if (summary.outcomeType !== "proceed_surgery") return false;
  const hasPlanSignal =
    Boolean(summary.recommendedProcedure.trim()) ||
    (summary.estimatedGraftsMin != null && summary.estimatedGraftsMax != null) ||
    summary.recommendedZones.length > 0;
  return hasPlanSignal;
}

export function handoffIdempotencyMetadata(formInstanceId: string, source: string): Record<string, unknown> {
  return { form_instance_id: formInstanceId, source };
}

export function buildSurgeryHandoffStrategyNotes(summary: ConsultationCompletionSummary, maxLen = 15000): string {
  const parts = [summary.recommendedProcedure, summary.quoteNotes, summary.clinicianNotesPreview].map((s) => s.trim()).filter(Boolean);
  const t = parts.join("\n\n");
  return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
}

export function addBusinessDaysUtc(from: Date, businessDays: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
}
