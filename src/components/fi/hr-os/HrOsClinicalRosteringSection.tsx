import { AlertTriangle, Calendar, Clock, Users } from "lucide-react";

import type { WorkforceRosterOverview } from "@/src/lib/workforce-os/workforceRostering.server";

function statusLabel(status: WorkforceRosterOverview["todaysStaffingReadiness"][number]["status"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "missing_roles":
      return "Missing roles";
    case "blocked_assignment":
      return "Blocked assignment";
    case "warning":
      return "Warning";
  }
}

function statusClass(status: WorkforceRosterOverview["todaysStaffingReadiness"][number]["status"]): string {
  switch (status) {
    case "ready":
      return "text-emerald-300";
    case "missing_roles":
      return "text-amber-300";
    case "blocked_assignment":
      return "text-rose-300";
    case "warning":
      return "text-amber-200";
  }
}

function formatRequiredRoles(roles: Record<string, number>): string {
  const entries = Object.entries(roles);
  if (entries.length === 0) return "—";
  return entries.map(([role, count]) => `${role} ×${count}`).join(", ");
}

export function HrOsClinicalRosteringSection({ overview }: { overview: WorkforceRosterOverview }) {
  return (
    <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F1629]/60 p-6">
      <h2 className="text-sm font-semibold text-slate-100">Clinical Rostering Foundation</h2>
      <p className="mt-2 text-sm text-slate-400">
        Operational workforce orchestration — shifts, availability, staffing templates, and clinical event assignments.
        Full calendar UI ships in a later phase.
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <dt className="flex items-center gap-2 text-slate-500">
            <Calendar className="h-4 w-4" aria-hidden />
            Shifts scheduled this week
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-100">{overview.shiftsScheduledThisWeek}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <dt className="flex items-center gap-2 text-slate-500">
            <Clock className="h-4 w-4" aria-hidden />
            Availability blocks
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-100">{overview.availabilityBlocksCount}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <dt className="flex items-center gap-2 text-slate-500">
            <Users className="h-4 w-4" aria-hidden />
            Staff assigned to clinical events
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-100">{overview.staffAssignedToEvents}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <dt className="flex items-center gap-2 text-slate-500">
            <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
            Events with staffing warnings
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-amber-300">{overview.eventsWithStaffingWarnings}</dd>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <dt className="flex items-center gap-2 text-slate-500">
            <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden />
            Events missing required roles
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-rose-300">{overview.eventsMissingRequiredRoles}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today&apos;s staffing readiness</h3>
        {overview.todaysStaffingReadiness.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No clinical event assignments scheduled for today.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Event type</th>
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Required roles</th>
                  <th className="pb-2 pr-4 font-medium">Assigned</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.todaysStaffingReadiness.map((row, idx) => (
                  <tr key={`${row.eventType}-${row.timeLabel}-${idx}`} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4 capitalize text-slate-200">{row.eventType.replace(/_/g, " ")}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-400">{row.timeLabel}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{formatRequiredRoles(row.requiredRoles)}</td>
                    <td className="py-2.5 pr-4 text-slate-200">{row.assignedStaffCount}</td>
                    <td className={`py-2.5 font-medium ${statusClass(row.status)}`}>{statusLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
