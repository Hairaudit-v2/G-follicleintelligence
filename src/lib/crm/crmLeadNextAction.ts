import type { FiCrmTaskRow } from "./types";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";

export type CrmLeadNextAction = {
  kind: "task" | "reminder" | "none";
  label: string;
  atIso: string | null;
};

export function deriveCrmLeadNextAction(
  tasks: FiCrmTaskRow[],
  reminderJobs: FiReminderJobWithTemplate[]
): CrmLeadNextAction {
  const openTasks = tasks.filter((t) => t.completed_at == null);
  const withDue = openTasks
    .filter((t) => t.due_at)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  if (withDue[0]) {
    return {
      kind: "task",
      label: withDue[0].title,
      atIso: withDue[0].due_at,
    };
  }
  if (openTasks[0]) {
    return { kind: "task", label: openTasks[0].title, atIso: null };
  }

  const now = Date.now();
  const pending = reminderJobs
    .filter((j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= now - 120_000)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  if (pending[0]) {
    return {
      kind: "reminder",
      label: pending[0].template_name || "Scheduled reminder",
      atIso: pending[0].scheduled_at,
    };
  }

  return { kind: "none", label: "No open tasks or upcoming reminders", atIso: null };
}
