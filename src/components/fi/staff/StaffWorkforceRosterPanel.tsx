import { AlertTriangle, Calendar, Clock, Stethoscope } from "lucide-react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { StaffRosterProfile } from "@/src/lib/workforce-os/workforceRostering.server";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function StaffWorkforceRosterPanel({
  profile,
  variant = "dark",
}: {
  profile: StaffRosterProfile;
  variant?: "dark" | "light";
}) {
  const textMuted = variant === "dark" ? "text-[#94A3B8]" : "text-slate-500";
  const textMain = variant === "dark" ? "text-[#E2E8F0]" : "text-slate-200";
  const border = variant === "dark" ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50";

  return (
    <DashboardCard className="p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <Calendar className="mt-0.5 h-5 w-5 text-[#22C1FF]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Roster &amp; availability</h2>
          <p className={`mt-1 text-sm ${textMuted}`}>
            Upcoming shifts, availability blocks, and clinical event assignments. Read-only in this phase.
          </p>
        </div>
      </div>

      {profile.assignmentWarnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <div>
              <p className="text-sm font-medium text-amber-100">Assignment warnings</p>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-100/90">
                {profile.assignmentWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        <div>
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${textMain}`}>
            <Clock className="h-4 w-4" aria-hidden />
            Upcoming shifts
          </h3>
          {profile.upcomingShifts.length === 0 ? (
            <p className={`mt-2 text-sm ${textMuted}`}>No upcoming shifts in the next 30 days.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.upcomingShifts.map((shift) => (
                <li key={shift.id} className={`rounded-lg border px-4 py-3 text-sm ${border}`}>
                  <p className={`font-medium capitalize ${textMain}`}>{shift.shift_type.replace(/_/g, " ")}</p>
                  <p className={`mt-0.5 ${textMuted}`}>
                    {formatDateTime(shift.starts_at)} → {formatDateTime(shift.ends_at)}
                  </p>
                  <p className={`mt-1 text-xs capitalize ${textMuted}`}>Status: {shift.status}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${textMain}`}>
            <Calendar className="h-4 w-4" aria-hidden />
            Active availability blocks
          </h3>
          {profile.activeAvailabilityBlocks.length === 0 ? (
            <p className={`mt-2 text-sm ${textMuted}`}>No active availability exceptions.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.activeAvailabilityBlocks.map((block) => (
                <li key={block.id} className={`rounded-lg border px-4 py-3 text-sm ${border}`}>
                  <p className={`font-medium capitalize ${textMain}`}>{block.block_type.replace(/_/g, " ")}</p>
                  <p className={`mt-0.5 ${textMuted}`}>
                    {formatDateTime(block.starts_at)} → {formatDateTime(block.ends_at)}
                  </p>
                  {block.reason ? <p className={`mt-1 text-xs ${textMuted}`}>{block.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${textMain}`}>
            <Stethoscope className="h-4 w-4" aria-hidden />
            Recent clinical assignments
          </h3>
          {profile.recentClinicalAssignments.length === 0 ? (
            <p className={`mt-2 text-sm ${textMuted}`}>No clinical event assignments yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.recentClinicalAssignments.map((assignment) => (
                <li key={assignment.id} className={`rounded-lg border px-4 py-3 text-sm ${border}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`font-medium capitalize ${textMain}`}>{assignment.assigned_role}</p>
                    <span
                      className={
                        assignment.assignment_status === "blocked"
                          ? "rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-200"
                          : assignment.assignment_status === "confirmed"
                            ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200"
                            : "rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-300"
                      }
                    >
                      {assignment.assignment_status}
                    </span>
                  </div>
                  <p className={`mt-0.5 ${textMuted}`}>
                    {assignment.event_source}
                    {assignment.readiness_score != null ? ` · Readiness ${assignment.readiness_score}%` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
