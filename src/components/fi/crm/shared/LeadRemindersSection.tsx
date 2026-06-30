"use client";

import { useMemo } from "react";

import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadRemindersSectionProps = {
  reminderJobs: FiReminderJobWithTemplate[];
  limit?: number;
  /** Include jobs up to this many ms in the past (default 2 min). */
  pastGraceMs?: number;
  emptyMessage?: string;
};

function statusTone(s: FiReminderJobWithTemplate["status"]): "success" | "warning" | "danger" | "neutral" | "info" {
  if (s === "sent") return "success";
  if (s === "failed") return "danger";
  if (s === "cancelled") return "neutral";
  if (s === "processing") return "warning";
  if (s === "pending") return "info";
  return "neutral";
}

export function LeadRemindersSection({
  reminderJobs,
  limit = 10,
  pastGraceMs = 120_000,
  emptyMessage = "No pending reminder jobs scheduled ahead for this lead.",
}: LeadRemindersSectionProps) {
  const counts = useMemo(() => {
    const c = { pending: 0, processing: 0, sent: 0, failed: 0, cancelled: 0 };
    for (const j of reminderJobs) {
      c[j.status] += 1;
    }
    return c;
  }, [reminderJobs]);

  const upcomingReminders = useMemo(() => {
    const t = Date.now();
    return reminderJobs
      .filter((j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= t - pastGraceMs)
      .slice(0, limit);
  }, [reminderJobs, limit, pastGraceMs]);

  const recentFailed = useMemo(() => {
    return reminderJobs
      .filter((j) => j.status === "failed")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [reminderJobs]);

  const recentOther = useMemo(() => {
    return reminderJobs
      .filter((j) => j.status === "sent" || j.status === "cancelled")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 4);
  }, [reminderJobs]);

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Reminders</h3>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["pending", "processing", "sent", "failed", "cancelled"] as const).map((k) => (
          <FiStatusBadge key={k} tone={statusTone(k)} appearance="pill" density="compact">
            {k} {counts[k]}
          </FiStatusBadge>
        ))}
      </div>

      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Upcoming (pending)</h4>
      {upcomingReminders.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="mb-4 space-y-2 text-xs">
          {upcomingReminders.map((j) => (
            <li key={j.id} className="flex flex-col rounded border border-white/[0.06] p-2">
              <span className="font-medium text-slate-100">{j.template_name || "Reminder"}</span>
              <span className="text-slate-400">
                {j.scheduled_at} · <span className="font-mono text-[10px]">{j.template_trigger_event}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {recentFailed.length > 0 ? (
        <>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-300">Failed</h4>
          <ul className="mb-4 space-y-2 text-xs">
            {recentFailed.map((j) => (
              <li key={j.id} className="flex flex-col rounded border border-rose-100 bg-rose-500/10 p-2">
                <span className="font-medium text-slate-100">{j.template_name || "Reminder"}</span>
                <span className="text-slate-400">{j.scheduled_at}</span>
                {j.error_log ? <span className="mt-1 font-mono text-[10px] text-rose-300">{j.error_log}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {recentOther.length > 0 ? (
        <>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recent sent / cancelled</h4>
          <ul className="space-y-1.5 text-[11px] text-slate-400">
            {recentOther.map((j) => (
              <li key={j.id} className="flex justify-between gap-2 border-b border-gray-50 pb-1 last:border-0">
                <span className="min-w-0 truncate font-medium text-slate-200">{j.template_name}</span>
                <span className="shrink-0 text-gray-500">
                  {j.status} · {j.delivered_at ? String(j.delivered_at).slice(0, 10) : j.updated_at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
