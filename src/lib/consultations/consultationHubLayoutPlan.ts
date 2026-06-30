/**
 * Pure ordering rules for ConsultationOS pathway-first hub (testable, no React).
 *
 * When `hasPathwayCompletionSummary` is false, the hub prioritises starting a pathway.
 * When true, intelligence + routing lead; pathway cards support review / additional pathways.
 *
 * **DOM alignment:** `ConsultationOsWorkspace` renders the pathway hero immediately after the workflow
 * notice when there is no summary (before alerts/admin). With a summary, alerts and break-glass admin
 * precede the mapped sections so operators still see system feedback first.
 */

export const CONSULTATION_HUB_SECTION_IDS = [
  "intelligence_summary",
  "routing",
  "pathway_launcher",
  "intake",
  "checklist",
] as const;

export type ConsultationHubSectionId = (typeof CONSULTATION_HUB_SECTION_IDS)[number];

export type ConsultationHubLayoutPlan = {
  hasPathwayCompletionSummary: boolean;
  /** Sections to render in order (checklist appended separately when patient linked). */
  orderedSections: ConsultationHubSectionId[];
  showRoutingTiles: boolean;
  showIntelligenceSummary: boolean;
};

export function buildConsultationHubLayoutPlan(
  hasPathwayCompletionSummary: boolean
): ConsultationHubLayoutPlan {
  if (!hasPathwayCompletionSummary) {
    return {
      hasPathwayCompletionSummary: false,
      orderedSections: ["pathway_launcher", "intake"],
      showRoutingTiles: false,
      showIntelligenceSummary: false,
    };
  }
  return {
    hasPathwayCompletionSummary: true,
    orderedSections: ["intelligence_summary", "routing", "pathway_launcher", "intake"],
    showRoutingTiles: true,
    showIntelligenceSummary: true,
  };
}

export function consultationHubSectionIndex(
  plan: ConsultationHubLayoutPlan,
  id: ConsultationHubSectionId
): number {
  return plan.orderedSections.indexOf(id);
}
