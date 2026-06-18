import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ReceptionOsSeverityBadge } from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import type { ReceptionOsDailyBrief } from "@/src/lib/receptionOs/receptionDailyBriefModel";

export function ReceptionOsDailyBriefWidget({ brief }: { brief: ReceptionOsDailyBrief }) {
  return (
    <DashboardCard className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Daily brief"
          description={`Operational risk · ${brief.projectedOperationalRisk}`}
        />
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <BriefStat label="Today's patients" value={brief.todayPatientCount} />
        <BriefStat label="Outstanding deposits" value={brief.outstandingDepositCount} hint={brief.overdueDepositCount ? `${brief.overdueDepositCount} overdue` : undefined} />
        <BriefStat label="Surgeries (14d)" value={brief.surgeryNext14Count} hint={brief.surgeryRiskCount ? `${brief.surgeryRiskCount} at risk` : undefined} />
        <BriefStat label="Open tasks" value={brief.openTaskCount} />
      </div>
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Alerts by severity</span>
          <ReceptionOsSeverityBadge severity="blocked" className={brief.alertsBySeverity.blocked ? undefined : "opacity-40"} />
          <span className="text-xs text-slate-500">{brief.alertsBySeverity.blocked}</span>
          <ReceptionOsSeverityBadge severity="critical" className={brief.alertsBySeverity.critical ? undefined : "opacity-40"} />
          <span className="text-xs text-slate-500">{brief.alertsBySeverity.critical}</span>
          <ReceptionOsSeverityBadge severity="warning" className={brief.alertsBySeverity.warning ? undefined : "opacity-40"} />
          <span className="text-xs text-slate-500">{brief.alertsBySeverity.warning}</span>
          <ReceptionOsSeverityBadge severity="info" className={brief.alertsBySeverity.info ? undefined : "opacity-40"} />
          <span className="text-xs text-slate-500">{brief.alertsBySeverity.info}</span>
        </div>
        <ul className="space-y-1 text-sm text-slate-400">
          {brief.summaryLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}

function BriefStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-amber-400/90">{hint}</p> : null}
    </div>
  );
}
