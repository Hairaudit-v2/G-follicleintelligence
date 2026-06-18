import Link from "next/link";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import type { SurgeryOsGraftSummary } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function StatCell({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", accent ? "text-cyan-300" : "text-slate-100")}>
        {value}
      </p>
    </div>
  );
}

function reconciliationTone(status: SurgeryOsGraftSummary["reconciliationStatus"]): string {
  switch (status) {
    case "balanced":
    case "completed":
      return "text-emerald-400";
    case "mismatch":
      return "text-rose-400";
    default:
      return "text-amber-400";
  }
}

export function SurgeryOsGraftIntelligenceWidget({ graftSummary }: { graftSummary: SurgeryOsGraftSummary[] }) {
  return (
    <DashboardCard className="flex h-full min-h-[360px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Live graft intelligence"
          description={`${graftSummary.length} surgery session(s) · extraction & implantation`}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {graftSummary.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Layers className="mb-2 h-8 w-8 text-slate-600" aria-hidden />
            <p className="text-sm text-slate-400">No graft sessions for today&apos;s surgeries.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {graftSummary.map((g) => {
              const href = g.hrefs.surgery ?? g.hrefs.case ?? g.hrefs.patient;
              const inner = (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{g.patientLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Phase: <span className="text-slate-300">{g.phaseLabel}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Reconciliation</p>
                      <p className={cn("text-xs font-semibold", reconciliationTone(g.reconciliationStatus))}>
                        {SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS[g.reconciliationStatus]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <StatCell label="Target" value={g.targetGrafts ?? "—"} />
                    <StatCell label="Extracted" value={g.extractedGrafts} accent />
                    <StatCell label="Implanted" value={g.implantedGrafts} accent />
                    <StatCell label="Remaining" value={g.remainingGrafts} />
                    <StatCell label="Discarded" value={g.discardedGrafts} />
                    <StatCell
                      label="Progress"
                      value={g.progressPercent != null ? `${g.progressPercent}%` : "—"}
                      accent
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    <StatCell label="Singles" value={g.singles} />
                    <StatCell label="Doubles" value={g.doubles} />
                    <StatCell label="Triples" value={g.triples} />
                    <StatCell label="Multiples" value={g.multiples} />
                    <StatCell label="Total hairs" value={g.totalHairs} />
                    <StatCell
                      label="Avg hairs/graft"
                      value={g.averageHairsPerGraft != null ? g.averageHairsPerGraft.toFixed(2) : "—"}
                    />
                  </div>
                </div>
              );

              return (
                <li key={g.surgeryId}>
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
