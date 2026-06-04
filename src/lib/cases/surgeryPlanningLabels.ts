import type { SurgeryPlanningStatusValue } from "./surgeryPlanningTypes";

export { SURGERY_PLANNING_STATUS_VALUES } from "./surgeryPlanningTypes";

const STATUS_LABELS: Record<SurgeryPlanningStatusValue, string> = {
  draft: "Draft",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  approved: "Approved",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

export function surgeryPlanningStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return STATUS_LABELS.draft;
  const k = status.trim().toLowerCase();
  if (k in STATUS_LABELS) return STATUS_LABELS[k as SurgeryPlanningStatusValue];
  return status.trim();
}
