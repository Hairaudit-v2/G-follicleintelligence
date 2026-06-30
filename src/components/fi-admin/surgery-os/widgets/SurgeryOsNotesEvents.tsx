import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  SurgeryOsSeverityBadge,
  SURGERY_OS_SEVERITY_SURFACE,
} from "@/src/components/fi-admin/surgery-os/surgeryOsSeverityStyles";
import type { SurgeryOsOperationalNote } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}

export function SurgeryOsNotesEventsWidget({ notes }: { notes: SurgeryOsOperationalNote[] }) {
  return (
    <DashboardCard className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title="Surgical notes & events" description="Intra-operative capture" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <FileText className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">No intra-operative notes recorded yet.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((n) => {
              const styles = SURGERY_OS_SEVERITY_SURFACE[n.severity];
              return (
                <li
                  key={n.id}
                  className={cn("rounded-lg border px-3 py-2.5", styles.border, styles.bg)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {n.noteKindLabel}
                    </p>
                    <SurgeryOsSeverityBadge severity={n.severity} />
                    <span className="text-xs tabular-nums text-slate-400">{formatTimestamp(n.recordedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {n.patientLabel}
                    {n.recordedByLabel ? ` · ${n.recordedByLabel}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
