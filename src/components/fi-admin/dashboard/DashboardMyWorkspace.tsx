import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { FI_WORKSPACE_PROFILES } from "@/src/config/fiWorkspaceProfiles";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";
import type {
  DashboardReminderItem,
  TaskDueItem,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

/**
 * TODO(Stage 2 loader): Add explicit “my consultations / my bookings / my cases” lists with
 * assignee filters on the server. Today we only surface rows already present on the operational payload.
 */

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function DashboardMyWorkspace(props: {
  base: string;
  viewerFiUserId: string | null;
  tasksDue: readonly TaskDueItem[];
  upcomingReminders: readonly DashboardReminderItem[];
  workspaceProfile?: FiWorkspaceProfileKey;
}) {
  const { base, viewerFiUserId, tasksDue, upcomingReminders, workspaceProfile } = props;
  const meta = FI_DASHBOARD_WIDGET_LABELS.my_workspace;
  const profileHints =
    workspaceProfile && workspaceProfile !== "default"
      ? (FI_WORKSPACE_PROFILES[workspaceProfile]?.priorityTaskTypes ?? [])
      : [];

  const myTasks = viewerFiUserId
    ? tasksDue.filter((t) => t.assigneeUserId != null && t.assigneeUserId === viewerFiUserId)
    : [];
  const myReminders = viewerFiUserId
    ? upcomingReminders.filter(
        (r) =>
          (r.bookingAssigneeFiUserId != null && r.bookingAssigneeFiUserId === viewerFiUserId) ||
          (r.leadPrimaryOwnerFiUserId != null && r.leadPrimaryOwnerFiUserId === viewerFiUserId)
      )
    : [];

  const hasAny = myTasks.length > 0 || myReminders.length > 0;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="dash-my-workspace-heading">
      <SectionHeader
        id="dash-my-workspace-heading"
        kicker="Personal"
        title={meta.title}
        description={meta.description}
      />
      {!viewerFiUserId ? (
        <p className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-4 text-sm text-slate-400">
          Sign in with a tenant user account to see assigned tasks and reminders here.
        </p>
      ) : !hasAny ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] bg-black/15 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-200">Nothing assigned today.</p>
          <p className="mt-1 text-xs text-slate-500">
            When CRM tasks or reminders are tied to you as assignee or owner, they will appear in
            this space.
          </p>
          {profileHints.length ? (
            <div className="mt-4 text-left">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Typical focus
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-400">
                {profileHints.slice(0, 4).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              My CRM tasks
            </p>
            <ul className="mt-2 space-y-2">
              {myTasks.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`${base}/crm/leads/${t.leadId}`}
                    className="block rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 transition hover:border-cyan-500/25 hover:bg-cyan-500/[0.04]"
                  >
                    <span className="line-clamp-2 text-sm font-medium text-slate-100">
                      {t.title}
                    </span>
                    <span className="mt-0.5 block text-[0.7rem] text-slate-500">
                      {formatDue(t.dueAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              My reminders
            </p>
            <ul className="mt-2 space-y-2">
              {myReminders.slice(0, 8).map((r) => (
                <li key={r.jobId}>
                  <Link
                    href={r.detailHref}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 transition",
                      "hover:border-cyan-500/25 hover:bg-cyan-500/[0.04]"
                    )}
                  >
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/80" aria-hidden />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-medium text-slate-100">
                        {r.templateName}
                      </span>
                      <span className="mt-0.5 block text-[0.7rem] text-slate-500">
                        {r.recipientLabel}
                      </span>
                      <span className="mt-0.5 block font-mono text-[0.65rem] text-slate-600">
                        {formatDue(r.scheduled_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
