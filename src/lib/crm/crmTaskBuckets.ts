/**
 * Group CRM tasks for lead-detail UI (Stage 2I). Pure; uses UTC calendar dates for "today".
 */

import type { FiCrmTaskRow } from "./types";

export type CrmTaskUiBucket = "overdue" | "due_today" | "upcoming" | "no_due" | "completed";

export type CrmTasksGroupedByBucket = Record<CrmTaskUiBucket, FiCrmTaskRow[]>;

function utcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dueUtcYmd(dueAtIso: string | null): string | null {
  if (!dueAtIso?.trim()) return null;
  const t = Date.parse(dueAtIso);
  if (Number.isNaN(t)) return null;
  return utcYmd(new Date(t));
}

function sortTasks(a: FiCrmTaskRow, b: FiCrmTaskRow): number {
  const da = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
  const db = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return a.title.localeCompare(b.title);
}

/**
 * Buckets open tasks by `due_at` vs `now` (UTC date). Completed = `completed_at` set.
 */
export function groupCrmTasksByBuckets(tasks: FiCrmTaskRow[], now: Date): CrmTasksGroupedByBucket {
  const empty = (): CrmTasksGroupedByBucket => ({
    overdue: [],
    due_today: [],
    upcoming: [],
    no_due: [],
    completed: [],
  });
  const out = empty();
  const today = utcYmd(now);

  for (const t of tasks) {
    if (t.completed_at) {
      out.completed.push(t);
      continue;
    }
    const ymd = dueUtcYmd(t.due_at);
    if (!ymd) {
      out.no_due.push(t);
      continue;
    }
    if (ymd < today) out.overdue.push(t);
    else if (ymd === today) out.due_today.push(t);
    else out.upcoming.push(t);
  }

  for (const k of Object.keys(out) as CrmTaskUiBucket[]) {
    out[k].sort(sortTasks);
  }
  return out;
}
