import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { SurgeryOsTeamMember } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

const STATUS_DOT: Record<string, string> = {
  assigned: "bg-slate-400",
  confirmed: "bg-sky-400",
  active: "bg-emerald-400",
  break: "bg-amber-400",
  unavailable: "bg-rose-400",
};

export function SurgeryOsTeamAssignmentBoardWidget({ team }: { team: SurgeryOsTeamMember[] }) {
  const grouped = team.reduce<Record<string, SurgeryOsTeamMember[]>>((acc, m) => {
    const key = m.surgeryId;
    acc[key] = acc[key] ?? [];
    acc[key].push(m);
    return acc;
  }, {});

  const groups = Object.entries(grouped);

  return (
    <DashboardCard className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title="Team assignment board" description={`${team.length} assignments`} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Users className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">
              No team assignments for today&apos;s surgeries.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map(([surgeryId, members]) => (
              <li
                key={surgeryId}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {members[0]?.patientLabel ?? "Surgery"}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="text-slate-200">{m.staffLabel}</span>
                        <span className="ml-2 text-xs text-slate-500">{m.roleLabel}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            STATUS_DOT[m.assignmentStatus] ?? "bg-slate-400"
                          )}
                          aria-hidden
                        />
                        <span className="text-xs text-slate-400">{m.assignmentStatusLabel}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
