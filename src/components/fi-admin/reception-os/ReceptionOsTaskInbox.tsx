"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, Inbox, Loader2, MessageSquarePlus, Play, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  addReceptionTaskNoteAction,
  setReceptionTaskStatusAction,
  snoozeReceptionTaskAction,
} from "@/lib/actions/fi-reception-task-actions";
import { ReceptionOsSeverityBadge } from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import { ReceptionOsCommunicationActionBar } from "@/src/components/fi-admin/reception-os/ReceptionOsCommunicationActionBar";
import { buildContextFromTask } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";
import type { ReceptionOsTaskItem } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { compareReceptionOsSeverity } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { receptionTaskActionAllowed, type ReceptionTaskStatus } from "@/src/lib/receptionOs/receptionTaskPolicy";

function snoozeUntilTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function ReceptionOsTaskInbox({
  tenantId,
  tenantName,
  role,
  tasks,
  allowedStatuses,
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  role: ReceptionOsViewerRole;
  tasks: ReceptionOsTaskItem[];
  allowedStatuses: readonly ReceptionTaskStatus[];
  onMutated: () => void;
}) {
  const filtered = useMemo(() => {
    const allowed = new Set(allowedStatuses);
    return [...tasks]
      .filter((t) => allowed.has(t.status))
      .sort((a, b) => compareReceptionOsSeverity(b.severity, a.severity));
  }, [tasks, allowedStatuses]);

  return (
    <DashboardCard className="flex min-h-[240px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title="Reception tasks" description={`${filtered.length} in this mode`} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Inbox className="mb-2 h-8 w-8 text-slate-600" aria-hidden />
            <p className="text-sm text-slate-400">No open tasks for this operating mode.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                tenantId={tenantId}
                tenantName={tenantName}
                role={role}
                task={task}
                onMutated={onMutated}
              />
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}

function TaskRow({
  tenantId,
  tenantName,
  role,
  task,
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  role: ReceptionOsViewerRole;
  task: ReceptionOsTaskItem;
  onMutated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Action failed.");
      else onMutated();
    });
  };

  return (
    <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ReceptionOsSeverityBadge severity={task.severity} />
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {task.sourceType} · {task.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 font-medium text-slate-100">{task.title}</p>
      {task.description ? <p className="mt-0.5 text-xs text-slate-500">{task.description}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {receptionTaskActionAllowed(role, "mark_in_progress") && task.status === "open" ? (
          <TaskChip
            icon={Play}
            label="In progress"
            disabled={pending}
            onClick={() => run(() => setReceptionTaskStatusAction(tenantId, { task_id: task.id, status: "in_progress" }))}
          />
        ) : null}
        {receptionTaskActionAllowed(role, "snooze") ? (
          <TaskChip
            icon={Clock}
            label="Snooze"
            disabled={pending}
            onClick={() =>
              run(() => snoozeReceptionTaskAction(tenantId, { task_id: task.id, snoozed_until: snoozeUntilTomorrow() }))
            }
          />
        ) : null}
        {receptionTaskActionAllowed(role, "resolve") ? (
          <TaskChip
            icon={CheckCircle2}
            label="Resolve"
            disabled={pending}
            onClick={() => run(() => setReceptionTaskStatusAction(tenantId, { task_id: task.id, status: "resolved" }))}
          />
        ) : null}
        {receptionTaskActionAllowed(role, "dismiss") ? (
          <TaskChip
            icon={XCircle}
            label="Dismiss"
            disabled={pending}
            onClick={() => run(() => setReceptionTaskStatusAction(tenantId, { task_id: task.id, status: "dismissed" }))}
          />
        ) : null}
        {receptionTaskActionAllowed(role, "add_note") ? (
          <TaskChip icon={MessageSquarePlus} label="Note" disabled={pending} onClick={() => setNoteOpen((v) => !v)} />
        ) : null}
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden /> : null}
      </div>
      <ReceptionOsCommunicationActionBar
        tenantId={tenantId}
        clinicName={tenantName}
        context={buildContextFromTask(task, tenantName)}
        showPaymentLink={task.sourceType === "payment"}
        paymentRecordId={task.paymentId}
        onMutated={onMutated}
        className="mt-1.5"
      />
      {noteOpen ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            run(async () => {
              const res = await addReceptionTaskNoteAction(tenantId, { task_id: task.id, note: note.trim() });
              if (res.ok) {
                setNote("");
                setNoteOpen(false);
              }
              return res;
            });
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note…"
            className={cn(fiOsChromeClasses.toolbarControlSurface, "min-w-0 flex-1 px-2 py-1.5 text-xs text-slate-200")}
          />
          <button
            type="submit"
            disabled={pending || !note.trim()}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "px-2 py-1.5 text-xs font-semibold text-cyan-100")}
          >
            Save
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : null}
    </li>
  );
}

function TaskChip({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        fiOsChromeClasses.toolbarControlSurface,
        "inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] font-semibold text-slate-300 disabled:opacity-50",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}
