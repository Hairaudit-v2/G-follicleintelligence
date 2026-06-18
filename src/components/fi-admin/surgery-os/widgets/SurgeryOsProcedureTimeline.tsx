import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { SurgeryOsProcedureTimelineEvent } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function SurgeryOsProcedureTimelineWidget({ events }: { events: SurgeryOsProcedureTimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return (
    <DashboardCard className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title="Live procedure timeline" description="Timestamped surgical events" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Clock className="mb-2 h-8 w-8 text-slate-600" aria-hidden />
            <p className="text-sm text-slate-400">No procedure events recorded yet.</p>
          </div>
        ) : (
          <ol className="relative space-y-0 px-2 py-1">
            {sorted.map((ev, idx) => (
              <li key={ev.id} className="relative flex gap-3 pb-4">
                {idx < sorted.length - 1 ? (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-white/[0.08]" aria-hidden />
                ) : null}
                <span className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-cyan-400/60 bg-[#081020]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-slate-100">{ev.eventLabel}</p>
                    <span className="text-xs tabular-nums text-cyan-400/80">{formatTimestamp(ev.occurredAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{ev.patientLabel}</p>
                  {ev.recordedByLabel ? (
                    <p className="text-xs text-slate-600">Recorded by {ev.recordedByLabel}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </DashboardCard>
  );
}
