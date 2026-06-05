import type { FiCrmTaskRow } from "./types";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import {
  formatUpcomingBookingLabel,
  pickNextUpcomingLeadBooking,
} from "@/src/lib/bookings/bookingLeadSummary";
import type { FiBookingRow } from "@/src/lib/bookings/types";

export type CrmLeadNextActionKind = "task" | "reminder" | "appointment" | "none";

export type CrmLeadNextAction = {
  kind: CrmLeadNextActionKind;
  label: string;
  atIso: string | null;
};

export function deriveCrmLeadNextAction(
  tasks: FiCrmTaskRow[],
  reminderJobs: FiReminderJobWithTemplate[],
  leadBookings: FiBookingRow[] = [],
  now: Date = new Date()
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

  const nextBooking = pickNextUpcomingLeadBooking(leadBookings, now);
  if (nextBooking) {
    return {
      kind: "appointment",
      label: formatUpcomingBookingLabel(nextBooking),
      atIso: nextBooking.start_at,
    };
  }

  if (openTasks[0]) {
    return { kind: "task", label: openTasks[0].title, atIso: null };
  }

  const nowMs = now.getTime();
  const pending = reminderJobs
    .filter((j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= nowMs - 120_000)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  if (pending[0]) {
    return {
      kind: "reminder",
      label: pending[0].template_name || "Scheduled reminder",
      atIso: pending[0].scheduled_at,
    };
  }

  return { kind: "none", label: "No open tasks or upcoming visits", atIso: null };
}
