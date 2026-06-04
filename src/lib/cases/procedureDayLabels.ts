import type { ProcedureStatusValue } from "./procedureDayTypes";
import { PROCEDURE_STATUS_VALUES } from "./procedureDayTypes";

export { PROCEDURE_STATUS_VALUES };

const LABELS: Record<ProcedureStatusValue, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  aborted: "Aborted",
};

export function procedureStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return LABELS.scheduled;
  const k = status.trim().toLowerCase();
  if (k in LABELS) return LABELS[k as ProcedureStatusValue];
  return status.trim();
}
