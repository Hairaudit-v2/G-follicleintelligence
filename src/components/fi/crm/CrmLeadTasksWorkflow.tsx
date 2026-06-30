"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeCrmTaskAction,
  crmCreateTaskAction,
  reopenCrmTaskAction,
  updateCrmTaskAction,
} from "@/lib/actions/fi-crm-actions";
import type { CrmShellUserPickerOption, FiCrmTaskRow } from "@/src/lib/crm";
import {
  CRM_TASK_ACTIVE_STATUS_VALUES,
  CRM_TASK_TYPE_VALUES,
  groupCrmTasksByBuckets,
} from "@/src/lib/crm";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function assigneeLabel(options: CrmShellUserPickerOption[], id: string | null): string {
  if (!id) return "Unassigned";
  const o = options.find((x) => x.id === id);
  return o?.email?.trim() || o?.id || id;
}

function typesWithFallback(current: string): string[] {
  const u = new Set<string>([...CRM_TASK_TYPE_VALUES]);
  if (current?.trim()) u.add(current.trim());
  return Array.from(u);
}

function statusesWithFallback(current: string): string[] {
  const u = new Set<string>([...CRM_TASK_ACTIVE_STATUS_VALUES]);
  if (current?.trim() && current !== "done") u.add(current.trim());
  return Array.from(u);
}

const card =
  "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

export function CrmLeadTasksWorkflow({
  tenantId,
  leadId,
  tasks,
  assigneeOptions,
  groupingNowIso,
}: {
  tenantId: string;
  leadId: string;
  tasks: FiCrmTaskRow[];
  assigneeOptions: CrmShellUserPickerOption[];
  groupingNowIso: string;
}) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createType, setCreateType] = useState<string>(CRM_TASK_TYPE_VALUES[0]);
  const [createStatus, setCreateStatus] = useState<string>(CRM_TASK_ACTIVE_STATUS_VALUES[0]);
  const [createDue, setCreateDue] = useState("");
  const [createAssignee, setCreateAssignee] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editAssignee, setEditAssignee] = useState("");

  const buckets = useMemo(
    () => groupCrmTasksByBuckets(tasks, new Date(groupingNowIso)),
    [tasks, groupingNowIso]
  );

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  function startEdit(t: FiCrmTaskRow) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDesc(t.description ?? "");
    setEditType(t.task_type);
    setEditStatus(t.status === "done" ? "open" : t.status);
    setEditDue(toDatetimeLocalValue(t.due_at));
    setEditAssignee(t.assignee_user_id ?? "");
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const dueIso = fromDatetimeLocalValue(createDue);
      const r = await crmCreateTaskAction(
        tenantId,
        leadId,
        withAdmin({
          title: createTitle.trim(),
          description: createDesc.trim() || null,
          taskType: createType,
          status: createStatus,
          dueAt: dueIso,
          assigneeUserId: createAssignee.trim() || null,
        })
      );
      setFeedback(r.ok ? "Task created." : r.error);
      if (r.ok) {
        setCreateTitle("");
        setCreateDesc("");
        setCreateType(CRM_TASK_TYPE_VALUES[0]);
        setCreateStatus(CRM_TASK_ACTIVE_STATUS_VALUES[0]);
        setCreateDue("");
        setCreateAssignee("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(taskId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const dueIso = fromDatetimeLocalValue(editDue);
      const r = await updateCrmTaskAction(
        tenantId,
        leadId,
        taskId,
        withAdmin({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          taskType: editType,
          status: editStatus,
          dueAt: dueIso,
          assigneeUserId: editAssignee.trim() || null,
        })
      );
      setFeedback(r.ok ? "Task saved." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onComplete(taskId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const r = await completeCrmTaskAction(tenantId, leadId, taskId, withAdmin({}));
      setFeedback(r.ok ? "Task completed." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onReopen(taskId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const r = await reopenCrmTaskAction(tenantId, leadId, taskId, withAdmin({}));
      setFeedback(r.ok ? "Task reopened." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function renderTaskRow(t: FiCrmTaskRow) {
    const isDone = Boolean(t.completed_at);
    const editing = editingId === t.id;

    return (
      <li
        key={t.id}
        className={`rounded border p-2 text-sm ${isDone ? "border-white/[0.06] bg-white/[0.03] text-slate-400" : "border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md"}`}
      >
        {editing ? (
          <div className="space-y-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded border border-slate-700 px-2 py-1"
              placeholder="Title"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
              placeholder="Detail"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="rounded border border-slate-700 px-2 py-1 text-xs"
              >
                {typesWithFallback(editType).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="rounded border border-slate-700 px-2 py-1 text-xs"
              >
                {statusesWithFallback(editStatus).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="datetime-local"
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
              className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
            />
            <select
              value={editAssignee}
              onChange={(e) => setEditAssignee(e.target.value)}
              className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.email ?? o.id}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onSaveEdit(t.id)}
                className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className={`font-medium text-slate-100 ${isDone ? "line-through" : ""}`}>
                  {t.title}
                </span>
                <p className="text-xs text-gray-500">
                  {t.task_type} · {t.status}
                  {t.due_at ? ` · due ${t.due_at}` : ""}
                </p>
                <p className="text-xs text-gray-500">
                  Assignee: {assigneeLabel(assigneeOptions, t.assignee_user_id)}
                </p>
                {t.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{t.description}</p>
                ) : null}
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1">
                {!isDone ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(t)}
                      className="rounded border border-slate-700 px-2 py-0.5 text-xs disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onComplete(t.id)}
                      className="rounded bg-emerald-800 px-2 py-0.5 text-xs text-white disabled:opacity-50"
                    >
                      Complete
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReopen(t.id)}
                    className="rounded border border-amber-600 px-2 py-0.5 text-xs text-amber-200 disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </li>
    );
  }

  const sections: { key: keyof typeof buckets; label: string }[] = [
    { key: "overdue", label: "Overdue" },
    { key: "due_today", label: "Due today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "no_due", label: "No due date" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Tasks</h2>

      <label className="mb-3 block text-xs text-slate-400">
        FI admin key (optional)
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
        />
      </label>

      <form
        onSubmit={onCreate}
        className="mb-6 space-y-2 rounded border border-white/[0.06] bg-white/[0.03] p-3 text-sm"
      >
        <h3 className="text-xs font-semibold text-slate-200">New task</h3>
        <input
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
          className="w-full rounded border border-slate-700 px-2 py-1"
          placeholder="Title (required)"
          required
        />
        <textarea
          value={createDesc}
          onChange={(e) => setCreateDesc(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
          placeholder="Detail"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value)}
            className="rounded border border-slate-700 px-2 py-1 text-xs"
          >
            {CRM_TASK_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={createStatus}
            onChange={(e) => setCreateStatus(e.target.value)}
            className="rounded border border-slate-700 px-2 py-1 text-xs"
          >
            {CRM_TASK_ACTIVE_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <input
          type="datetime-local"
          value={createDue}
          onChange={(e) => setCreateDue(e.target.value)}
          className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
        />
        <select
          value={createAssignee}
          onChange={(e) => setCreateAssignee(e.target.value)}
          className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
        >
          <option value="">Unassigned</option>
          {assigneeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.email ?? o.id}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Create task
        </button>
      </form>

      {tasks.length === 0 ? <p className="text-sm text-slate-400">No tasks yet.</p> : null}

      <div className="space-y-5">
        {sections.map(({ key, label }) => {
          const list = buckets[key];
          if (list.length === 0) return null;
          return (
            <div key={key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </h3>
              <ul className="space-y-2">{list.map((t) => renderTaskRow(t))}</ul>
            </div>
          );
        })}
      </div>

      {feedback ? <p className="mt-3 text-sm text-slate-200">{feedback}</p> : null}
    </section>
  );
}
