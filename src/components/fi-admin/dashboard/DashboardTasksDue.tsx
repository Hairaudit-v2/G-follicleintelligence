import Link from "next/link";
import { ListTodo } from "lucide-react";

import type { TaskDueItem } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DashboardEmptyState } from "@/src/components/fi-admin/dashboard/DashboardEmptyState";

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function DashboardTasksDue(props: {
  tenantId: string;
  tasks: TaskDueItem[];
  viewerFiUserId: string | null;
}) {
  const { tenantId, tasks, viewerFiUserId } = props;

  return (
    <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="dash-tasks-heading">
      <SectionHeader
        id="dash-tasks-heading"
        kicker="Tasks"
        title="Tasks due"
        description={
          viewerFiUserId
            ? "Open CRM tasks assigned to you or unassigned in this tenant (due within two weeks or overdue)."
            : "Open unassigned CRM tasks in this tenant (sign in as a tenant member to include your personal queue)."
        }
        className="mb-4"
      />
      {tasks.length === 0 ? (
        <DashboardEmptyState
          icon={<ListTodo className="h-5 w-5" aria-hidden />}
          title="Task queue is clear"
          description="No open CRM tasks are assigned to you or waiting unassigned in this tenant."
          actionLabel="View leads"
          actionHref={`/fi-admin/${tenantId}/crm`}
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#081020]/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-[#22C1FF] sm:flex"
                  aria-hidden
                >
                  <ListTodo size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#F8FAFC]">{t.title}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {formatDue(t.dueAt)} · {t.taskType.replace(/_/g, " ")} · {t.status}
                    {t.isUnassigned ? (
                      <span className="text-amber-200/90"> · Unassigned</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <Link
                href={`/fi-admin/${tenantId}/crm/leads/${t.leadId}`}
                className="shrink-0 text-xs font-semibold text-[#22C1FF] underline-offset-2 hover:underline sm:text-sm"
              >
                Open lead
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
