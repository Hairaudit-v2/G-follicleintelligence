import type { FiCrmLeadRow, FiCrmPipelineStageRow } from "./types";

const BOOKING_TYPE_TARGET_SLUG: Record<string, string> = {
  consultation: "consult_completed",
  surgery: "in_treatment",
  follow_up: "nurture",
  review: "treatment_planning",
};

function sortedStages(stages: FiCrmPipelineStageRow[]): FiCrmPipelineStageRow[] {
  return [...stages].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Suggest a pipeline stage to move to after marking an appointment complete.
 */
export function suggestNextStageAfterAppointmentComplete(
  stages: FiCrmPipelineStageRow[],
  lead: FiCrmLeadRow,
  bookingType: string
): string | null {
  const sorted = sortedStages(stages);
  const currentId = lead.current_stage_id;
  if (!currentId) return sorted.find((s) => !s.is_lost && !s.is_won)?.id ?? null;

  const targetSlug = BOOKING_TYPE_TARGET_SLUG[bookingType.trim()];
  if (targetSlug) {
    const match = sorted.find((s) => s.slug === targetSlug && !s.is_lost);
    if (match && match.id !== currentId) return match.id;
  }

  const idx = sorted.findIndex((s) => s.id === currentId);
  if (idx < 0) return null;
  for (let i = idx + 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (!next.is_lost && !next.is_won) return next.id;
  }
  return null;
}
