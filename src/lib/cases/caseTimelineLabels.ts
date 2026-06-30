import type { CaseTimelineFilterPreset, CaseTimelineItemKind } from "./caseTimelineTypes";

const KIND_LABELS: Record<CaseTimelineItemKind, string> = {
  case_lifecycle: "Patient",
  lead: "Lead",
  booking: "Booking",
  image: "Image",
  surgery_plan: "Surgery plan",
  procedure_day: "Procedure day",
  post_op: "Post-op",
  follow_up: "Follow-up",
  crm_activity: "CRM activity",
  foundation_timeline: "Timeline event",
};

export function caseTimelineKindLabel(kind: CaseTimelineItemKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export const CASE_TIMELINE_FILTER_PRESETS: {
  id: CaseTimelineFilterPreset;
  label: string;
  hint: string;
}[] = [
  { id: "all", label: "All", hint: "Everything linked to this patient." },
  {
    id: "clinical",
    label: "Clinical & ops",
    hint: "Patient, planning, procedure, post-op, follow-ups, bookings, images, foundation milestones.",
  },
  { id: "crm", label: "CRM", hint: "Leads and CRM activity rows anchored on this patient." },
];

export function caseTimelinePresetIncludesKind(
  preset: CaseTimelineFilterPreset,
  kind: CaseTimelineItemKind
): boolean {
  if (preset === "all") return true;
  if (preset === "crm") {
    return kind === "lead" || kind === "crm_activity";
  }
  // clinical — everything except pure CRM stream kinds
  return kind !== "lead" && kind !== "crm_activity";
}
