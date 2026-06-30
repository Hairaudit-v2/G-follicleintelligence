"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquarePlus,
  Play,
  UserPlus,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  addReceptionTaskNoteAction,
  createReceptionTaskFromAlertAction,
  setReceptionTaskStatusAction,
  snoozeReceptionTaskAction,
} from "@/lib/actions/fi-reception-task-actions";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import {
  ReceptionOsSeverityBadge,
  RECEPTION_OS_SEVERITY_SURFACE,
} from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import { RECEPTION_OS_ALERT_LABELS } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type {
  ReceptionOsActionAlert,
  ReceptionOsTaskItem,
} from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import { ReceptionOsCommunicationActionBar } from "@/src/components/fi-admin/reception-os/ReceptionOsCommunicationActionBar";
import { buildContextFromActionAlert } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";
import { receptionTaskActionAllowed } from "@/src/lib/receptionOs/receptionTaskPolicy";
import { ReceptionOsPilotFeedbackControls } from "@/src/components/fi-admin/reception-os/ReceptionOsPilotFeedbackControls";
import type { ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";

function snoozeUntilTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function ReceptionOsActionAlertsPanel({
  tenantId,
  tenantName,
  role,
  alerts,
  tasks,
  operatingMode = "live_clinic",
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  role: ReceptionOsViewerRole;
  alerts: ReceptionOsActionAlert[];
  tasks: ReceptionOsTaskItem[];
  operatingMode?: ReceptionOsOperatingMode;
  onMutated: () => void;
}) {
  const tasksByRef = useMemo(() => {
    const map = new Map<string, ReceptionOsTaskItem>();
    for (const t of tasks) {
      if (t.sourceRefId) map.set(t.sourceRefId, t);
    }
    return map;
  }, [tasks]);

  const criticalCount = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "blocked"
  ).length;

  return (
    <DashboardCard className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Action required"
          description={
            criticalCount > 0
              ? `${criticalCount} critical · ${alerts.length} total`
              : `${alerts.length} items`
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {alerts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            All clear — no action items right now.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                tenantId={tenantId}
                tenantName={tenantName}
                role={role}
                alert={alert}
                linkedTask={tasksByRef.get(alert.id) ?? null}
                onMutated={onMutated}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-white/[0.06] px-4 py-2">
        <ReceptionOsPilotFeedbackControls
          tenantId={tenantId}
          operatingMode={operatingMode}
          widgetKey="action_alerts"
          compact
        />
      </div>
    </DashboardCard>
  );
}

function AlertRow({
  tenantId,
  tenantName,
  role,
  alert,
  linkedTask,
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  role: ReceptionOsViewerRole;
  alert: ReceptionOsActionAlert;
  linkedTask: ReceptionOsTaskItem | null;
  onMutated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const styles = RECEPTION_OS_SEVERITY_SURFACE[alert.severity];
  const primaryHref = alert.href ?? receptionOsPrimaryHref(alert.hrefs ?? {});

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Action failed.");
        return;
      }
      onMutated();
    });
  };

  return (
    <li>
      <div className={cn("rounded-lg border px-3 py-2.5", styles.border, styles.bg)}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {RECEPTION_OS_ALERT_LABELS[alert.kind]}
          </p>
          <ReceptionOsSeverityBadge severity={alert.severity} />
          {linkedTask ? (
            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-slate-300">
              Task · {linkedTask.status.replace(/_/g, " ")}
            </span>
          ) : null}
        </div>
        {primaryHref ? (
          <a href={primaryHref} className="mt-1 block font-medium text-slate-100 hover:underline">
            {alert.title}
          </a>
        ) : (
          <p className="mt-1 font-medium text-slate-100">{alert.title}</p>
        )}
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{alert.detail}</p>
        {alert.hrefs ? <ReceptionOsRecordLinks hrefs={alert.hrefs} className="mt-1.5" /> : null}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {!linkedTask && receptionTaskActionAllowed(role, "create_from_alert") ? (
            <ActionChip
              icon={UserPlus}
              label="Create task"
              disabled={pending}
              onClick={() => run(() => createReceptionTaskFromAlertAction(tenantId, { alert }))}
            />
          ) : null}
          {linkedTask &&
          receptionTaskActionAllowed(role, "mark_in_progress") &&
          linkedTask.status === "open" ? (
            <ActionChip
              icon={Play}
              label="In progress"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setReceptionTaskStatusAction(tenantId, {
                    task_id: linkedTask.id,
                    status: "in_progress",
                  })
                )
              }
            />
          ) : null}
          {linkedTask &&
          receptionTaskActionAllowed(role, "snooze") &&
          linkedTask.status !== "resolved" ? (
            <ActionChip
              icon={Clock}
              label="Snooze"
              disabled={pending}
              onClick={() =>
                run(() =>
                  snoozeReceptionTaskAction(tenantId, {
                    task_id: linkedTask.id,
                    snoozed_until: snoozeUntilTomorrow(),
                  })
                )
              }
            />
          ) : null}
          {linkedTask &&
          receptionTaskActionAllowed(role, "resolve") &&
          linkedTask.status !== "resolved" ? (
            <ActionChip
              icon={CheckCircle2}
              label="Resolve"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setReceptionTaskStatusAction(tenantId, {
                    task_id: linkedTask.id,
                    status: "resolved",
                  })
                )
              }
            />
          ) : null}
          {linkedTask &&
          receptionTaskActionAllowed(role, "dismiss") &&
          linkedTask.status !== "dismissed" ? (
            <ActionChip
              icon={XCircle}
              label="Dismiss"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setReceptionTaskStatusAction(tenantId, {
                    task_id: linkedTask.id,
                    status: "dismissed",
                  })
                )
              }
            />
          ) : null}
          {linkedTask && receptionTaskActionAllowed(role, "add_note") ? (
            <ActionChip
              icon={MessageSquarePlus}
              label="Note"
              disabled={pending}
              onClick={() => setNoteOpen((v) => !v)}
            />
          ) : null}
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden /> : null}
        </div>

        <ReceptionOsCommunicationActionBar
          tenantId={tenantId}
          clinicName={tenantName}
          context={buildContextFromActionAlert(alert, linkedTask, tenantName)}
          showPaymentLink={alert.kind === "missing_deposit"}
          onMutated={onMutated}
          className="mt-1.5"
        />

        {noteOpen && linkedTask ? (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              run(async () => {
                const res = await addReceptionTaskNoteAction(tenantId, {
                  task_id: linkedTask.id,
                  note: note.trim(),
                });
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
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "min-w-0 flex-1 px-2 py-1.5 text-xs text-slate-200"
              )}
            />
            <button
              type="submit"
              disabled={pending || !note.trim()}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "px-2 py-1.5 text-xs font-semibold text-cyan-100"
              )}
            >
              Save
            </button>
          </form>
        ) : null}

        {error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : null}
      </div>
    </li>
  );
}

function ActionChip({
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
        "inline-flex items-center gap-1 px-2 py-1 text-[0.68rem] font-semibold text-slate-300 disabled:opacity-50"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}
