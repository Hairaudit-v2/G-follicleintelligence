"use client";

import { useMemo } from "react";
import type { FiCrmTaskRow } from "@/src/lib/crm/types";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadTasksSectionProps = {
  tasks: FiCrmTaskRow[];
  canMutate: boolean;
  taskTitle: string;
  taskBusy?: boolean;
  taskErr?: string | null;
  onTaskTitleChange: (value: string) => void;
  onAddTask: (e: React.FormEvent) => void | Promise<void>;
  onCompleteTask: (taskId: string) => void | Promise<void>;
};

export function LeadTasksSection({
  tasks,
  canMutate,
  taskTitle,
  taskBusy = false,
  taskErr = null,
  onTaskTitleChange,
  onAddTask,
  onCompleteTask,
}: LeadTasksSectionProps) {
  const openTasks = useMemo(() => tasks.filter((t) => t.completed_at == null), [tasks]);

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Open tasks</h3>
      {openTasks.length === 0 ? (
        <p className="text-xs text-slate-400">No open tasks.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {openTasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-2 rounded border border-white/[0.06] p-2">
              <div>
                <p className="font-medium text-slate-100">{t.title}</p>
                <p className="text-gray-500">
                  {t.task_type} · {t.status}
                  {t.due_at ? ` · due ${t.due_at}` : ""}
                </p>
              </div>
              {canMutate ? (
                <button
                  type="button"
                  className="shrink-0 text-blue-300 hover:underline"
                  onClick={() => void onCompleteTask(t.id)}
                >
                  Done
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canMutate ? (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onAddTask}>
          <input
            value={taskTitle}
            onChange={(e) => onTaskTitleChange(e.target.value)}
            placeholder="New task title"
            className="min-w-0 flex-1 rounded border border-slate-700 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={taskBusy}
            className="rounded border border-slate-700 px-3 py-1.5 hover:bg-white/[0.03] disabled:opacity-50"
          >
            Add
          </button>
        </form>
      ) : null}
      {taskErr ? <p className="mt-1 text-xs text-rose-300">{taskErr}</p> : null}
    </section>
  );
}
