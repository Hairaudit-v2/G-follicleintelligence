/**
 * Build `changed_keys` metadata for `task.updated` activity (Stage 2I). Pure.
 */

export type TaskDetailComparableSnapshot = {
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  due_at: string | null;
  assignee_user_id: string | null;
};

function normDesc(d: string | null | undefined): string | null {
  if (d == null) return null;
  const t = d.trim();
  return t.length ? t : null;
}

function normDue(d: string | null | undefined): string | null {
  if (d == null || !String(d).trim()) return null;
  return String(d).trim();
}

export function taskDetailSnapshotFromRowLike(row: {
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  due_at: string | null;
  assignee_user_id: string | null;
}): TaskDetailComparableSnapshot {
  return {
    title: row.title.trim(),
    description: normDesc(row.description),
    task_type: row.task_type.trim(),
    status: row.status.trim(),
    due_at: normDue(row.due_at),
    assignee_user_id: row.assignee_user_id?.trim() || null,
  };
}

const TRACKED: (keyof TaskDetailComparableSnapshot)[] = [
  "title",
  "description",
  "task_type",
  "status",
  "due_at",
  "assignee_user_id",
];

export function collectChangedTaskDetailKeys(
  before: TaskDetailComparableSnapshot,
  after: TaskDetailComparableSnapshot
): (keyof TaskDetailComparableSnapshot)[] {
  const keys: (keyof TaskDetailComparableSnapshot)[] = [];
  for (const k of TRACKED) {
    if (before[k] !== after[k]) keys.push(k);
  }
  return keys;
}
