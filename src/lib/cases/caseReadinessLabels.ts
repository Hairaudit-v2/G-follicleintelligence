import type { CaseReadinessHealth, CaseReadinessSectionKey } from "./caseReadinessTypes";

const SECTION_TITLES: Record<CaseReadinessSectionKey, string> = {
  case_profile: "Patient profile",
  surgery_planning: "Surgery planning",
  procedure_day: "Procedure day",
  post_op: "Post-op tracking",
  follow_ups: "Follow-ups",
  images: "Images",
  bookings: "Bookings",
  timeline: "Timeline activity",
};

export function caseReadinessSectionTitle(key: CaseReadinessSectionKey): string {
  return SECTION_TITLES[key] ?? key;
}

export function caseReadinessHealthLabel(health: CaseReadinessHealth): string {
  switch (health) {
    case "complete":
      return "Ready";
    case "in_progress":
      return "In progress";
    case "needs_attention":
      return "Needs attention";
    case "not_started":
      return "Not started";
    default:
      return health;
  }
}
