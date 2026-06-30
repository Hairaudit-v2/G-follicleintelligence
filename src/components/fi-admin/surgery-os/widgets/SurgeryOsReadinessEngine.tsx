import Link from "next/link";
import { CheckCircle2, Circle, ClipboardCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { SURGERY_OS_RISK_SURFACE } from "@/src/components/fi-admin/surgery-os/surgeryOsSeverityStyles";
import type { SurgeryOsReadinessSnapshot } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

const RISK_PROGRESS_BAR: Record<string, string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
  blocked: "bg-fuchsia-400",
};

export function SurgeryOsReadinessEngineWidget({
  snapshots,
}: {
  snapshots: SurgeryOsReadinessSnapshot[];
}) {
  return (
    <DashboardCard className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Surgical readiness engine"
          description="Pre-op checklist · risk scoring"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <ClipboardCheck className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">No surgeries to assess readiness for today.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {snapshots.map((snap) => {
              const riskStyles =
                SURGERY_OS_RISK_SURFACE[snap.readinessRiskLevel] ?? SURGERY_OS_RISK_SURFACE.medium;
              const href = snap.hrefs.case ?? snap.hrefs.patient ?? snap.hrefs.surgery;
              const inner = (
                <div
                  className={cn("rounded-lg border px-3 py-3", riskStyles.border, riskStyles.bg)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-100">{snap.patientLabel}</p>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold tabular-nums", riskStyles.text)}>
                        {snap.readinessPercent}%
                      </span>
                      <span className={cn("text-xs font-semibold", riskStyles.text)}>
                        {snap.readinessRiskLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        RISK_PROGRESS_BAR[snap.readinessRiskLevel] ?? "bg-amber-400"
                      )}
                      style={{ width: `${snap.readinessPercent}%` }}
                    />
                  </div>
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {snap.checklist.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-center gap-1.5 text-xs text-slate-400"
                      >
                        {item.complete ? (
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                            aria-hidden
                          />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        )}
                        <span className={item.complete ? "text-slate-300" : undefined}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
              return (
                <li key={snap.surgeryId}>
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
