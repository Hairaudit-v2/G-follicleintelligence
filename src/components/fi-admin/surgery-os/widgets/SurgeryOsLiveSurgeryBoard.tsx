import Link from "next/link";
import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  SURGERY_OS_LIVE_STATUS_SURFACE,
} from "@/src/components/fi-admin/surgery-os/surgeryOsSeverityStyles";
import type { SurgeryOsLiveSurgery } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "—";
  }
}

function primaryHref(hrefs: SurgeryOsLiveSurgery["hrefs"]): string | null {
  return hrefs.case ?? hrefs.patient ?? hrefs.calendar ?? null;
}

export function SurgeryOsLiveSurgeryBoardWidget({ surgeries }: { surgeries: SurgeryOsLiveSurgery[] }) {
  return (
    <DashboardCard className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Live surgery board"
          description={`${surgeries.length} active · today`}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {surgeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Activity className="mb-2 h-8 w-8 text-slate-600" aria-hidden />
            <p className="text-sm text-slate-400">No active surgeries scheduled for today.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {surgeries.map((s) => {
              const liveStyles = SURGERY_OS_LIVE_STATUS_SURFACE[s.liveStatus] ?? SURGERY_OS_LIVE_STATUS_SURFACE.waiting;
              const href = primaryHref(s.hrefs);
              const inner = (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100">{s.patientLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.surgeonLabel ? `Surgeon: ${s.surgeonLabel}` : "Surgeon unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", liveStyles.dot)} aria-hidden />
                      <span className={cn("text-xs font-semibold", liveStyles.text)}>{s.liveStatusLabel}</span>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                    <span>Phase: <span className="text-slate-300">{s.procedurePhaseLabel}</span></span>
                    <span>Start: <span className="text-slate-300">{formatTime(s.scheduledStartAt)}</span></span>
                    <span>Grafts: <span className="text-slate-300">{s.targetGrafts ?? "—"}</span></span>
                    <span>Team: <span className="text-slate-300">{s.assignedTeamSummary ?? "—"}</span></span>
                  </div>
                </div>
              );
              return (
                <li key={s.id}>
                  {href ? (
                    <Link href={href} className="block transition hover:opacity-95">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
