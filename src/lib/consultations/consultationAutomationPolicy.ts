import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import { quoteDraftAutomationIntentEligible } from "@/src/lib/consultationForms/handoff/consultationHandoffPure";

export type ConsultationAutomationHandoffKind =
  | "follow_up_task"
  | "quote_draft"
  | "pathology_recommendation"
  | "surgery_planning_draft";

export type ConsultationAutomationEnabledHandoffs = Partial<
  Record<ConsultationAutomationHandoffKind, boolean>
>;

/**
 * Quote auto-run: explicit `enabledHandoffs.quote_draft === true` always allows evaluation (subject to
 * locked context + anchor checks in mutations). When no filter object is passed, require summary intent signals.
 */
export function quoteDraftAllowedForAutomationRun(
  enabledHandoffs: ConsultationAutomationEnabledHandoffs | undefined,
  summary: ConsultationCompletionSummary
): boolean {
  if (enabledHandoffs?.quote_draft === true) return true;
  if (!enabledHandoffs) return quoteDraftAutomationIntentEligible(summary);
  return false;
}
