"use client";

import { useMemo } from "react";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadRemindersSectionProps = {
  reminderJobs: FiReminderJobWithTemplate[];
  limit?: number;
  /** Include jobs up to this many ms in the past (default 2 min). */
  pastGraceMs?: number;
  emptyMessage?: string;
};

export function LeadRemindersSection({
  reminderJobs,
  limit = 10,
  pastGraceMs = 120_000,
  emptyMessage = "No pending reminder jobs scheduled ahead for this lead.",
}: LeadRemindersSectionProps) {
  const upcomingReminders = useMemo(() => {
    const now = Date.now();
    return reminderJobs
      .filter((j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= now - pastGraceMs)
      .slice(0, limit);
  }, [reminderJobs, limit, pastGraceMs]);

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming reminders</h3>
      {upcomingReminders.length === 0 ? (
        <p className="text-xs text-gray-600">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {upcomingReminders.map((j) => (
            <li key={j.id} className="flex flex-col rounded border border-gray-100 p-2">
              <span className="font-medium text-gray-900">{j.template_name || "Reminder"}</span>
              <span className="text-gray-600">
                {j.scheduled_at} · {j.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
