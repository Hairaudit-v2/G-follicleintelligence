import { Activity, AlertTriangle, Gauge, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type {
  ExtractionVelocitySnapshot,
  ImplantationSpeedSnapshot,
  SurgicalRiskDetectionSnapshot,
  TransectionMonitoringSnapshot,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

function MetricTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums text-slate-100", accent)}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function transectionStatusLabel(status: TransectionMonitoringSnapshot["status"]): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "acceptable":
      return "Acceptable";
    case "watch":
      return "Watch";
    case "critical":
      return "Critical";
    default:
      return status;
  }
}

function transectionStatusClass(status: TransectionMonitoringSnapshot["status"]): string {
  switch (status) {
    case "excellent":
      return "text-emerald-300";
    case "acceptable":
      return "text-cyan-300";
    case "watch":
      return "text-amber-300";
    case "critical":
      return "text-rose-300";
    default:
      return "text-slate-300";
  }
}

function implantationEfficiencyLabel(score: number): string {
  if (score >= 95) return "Optimal";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Moderate";
  return "Below target";
}

function PerformanceCard({
  extraction,
  transection,
  implantation,
  risks,
}: {
  extraction: ExtractionVelocitySnapshot;
  transection: TransectionMonitoringSnapshot;
  implantation: ImplantationSpeedSnapshot;
  risks: SurgicalRiskDetectionSnapshot;
}) {
  const topRisks = risks.detectedRisks.slice(0, 3);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{extraction.patientLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">{risks.summary}</p>
        </div>
        {risks.totalRisks > 0 ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
            {risks.totalRisks} risk{risks.totalRisks === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
            Clear
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          label="Extraction Velocity"
          value={
            extraction.extractionRatePerHour != null
              ? `${extraction.extractionRatePerHour} grafts/hour`
              : "—"
          }
          detail={
            extraction.efficiencyDeclinePercent != null
              ? `Efficiency decline ${extraction.efficiencyDeclinePercent}%`
              : extraction.summary.includes("No extraction")
                ? extraction.summary
                : undefined
          }
          accent="text-cyan-300"
        />
        <MetricTile
          label="Transection Monitoring"
          value={
            transection.transectionRate != null
              ? `${transection.transectionRate}% transection rate`
              : "—"
          }
          detail={transectionStatusLabel(transection.status)}
          accent={transectionStatusClass(transection.status)}
        />
        <MetricTile
          label="Implantation Speed"
          value={
            implantation.implantationRatePerHour != null
              ? `${implantation.implantationRatePerHour} grafts/hour`
              : "—"
          }
          detail={implantationEfficiencyLabel(implantation.efficiencyScore)}
          accent="text-violet-300"
        />
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-300" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Surgical Risk Alerts
          </p>
        </div>
        {topRisks.length === 0 ? (
          <p className="text-sm text-slate-400">No active procedural risks detected.</p>
        ) : (
          <ul className="space-y-2">
            {topRisks.map((risk) => (
              <li
                key={`${risk.title}:${risk.severity}`}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3 py-2",
                  risk.severity === "critical"
                    ? "border-rose-500/25 bg-rose-500/[0.06]"
                    : "border-amber-500/20 bg-amber-500/[0.06]"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    risk.severity === "critical" ? "text-rose-300" : "text-amber-300"
                  )}
                  aria-hidden
                />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {risk.severity === "critical" ? "Critical" : "Warning"}
                  </p>
                  <p className="text-sm font-medium text-slate-100">{risk.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{risk.recommendation}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SurgeryOsProceduralPerformanceWidget({
  extractionVelocity = [],
  transectionMonitoring = [],
  implantationSpeed = [],
  surgicalRisks = [],
}: {
  extractionVelocity?: ExtractionVelocitySnapshot[];
  transectionMonitoring?: TransectionMonitoringSnapshot[];
  implantationSpeed?: ImplantationSpeedSnapshot[];
  surgicalRisks?: SurgicalRiskDetectionSnapshot[];
}) {
  const bySurgery = new Map<
    string,
    {
      extraction: ExtractionVelocitySnapshot;
      transection: TransectionMonitoringSnapshot;
      implantation: ImplantationSpeedSnapshot;
      risks: SurgicalRiskDetectionSnapshot;
    }
  >();

  for (const extraction of extractionVelocity) {
    bySurgery.set(extraction.surgeryId, {
      extraction,
      transection: transectionMonitoring.find((t) => t.surgeryId === extraction.surgeryId) ?? {
        surgeryId: extraction.surgeryId,
        patientLabel: extraction.patientLabel,
        totalGraftsReviewed: 0,
        partialTransections: 0,
        fullTransections: 0,
        transectionRate: null,
        qualityScore: 100,
        status: "excellent",
        warnings: [],
        summary: "No transection monitoring data available.",
      },
      implantation: implantationSpeed.find((i) => i.surgeryId === extraction.surgeryId) ?? {
        surgeryId: extraction.surgeryId,
        patientLabel: extraction.patientLabel,
        implantedGrafts: 0,
        implantationRatePerHour: null,
        implantationDurationMinutes: null,
        efficiencyScore: 0,
        trendDirection: "stable",
        summary: "No implantation speed data available.",
      },
      risks: surgicalRisks.find((r) => r.surgeryId === extraction.surgeryId) ?? {
        surgeryId: extraction.surgeryId,
        patientLabel: extraction.patientLabel,
        totalRisks: 0,
        criticalRisks: 0,
        warningRisks: 0,
        detectedRisks: [],
        summary: "No active procedural risks detected.",
      },
    });
  }

  const rows = Array.from(bySurgery.values());

  return (
    <DashboardCard className="flex h-full min-h-[360px] flex-col overflow-hidden xl:col-span-3">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Procedural Performance Intelligence"
          description={`${rows.length} surgery session(s) · extraction velocity, transection quality, implantation speed & live risk`}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Activity className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">
              No procedural performance data available yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.extraction.surgeryId}>
                <PerformanceCard
                  extraction={row.extraction}
                  transection={row.transection}
                  implantation={row.implantation}
                  risks={row.risks}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-white/[0.06] px-4 py-2">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          Live performance intelligence · Sprint 2
        </p>
      </div>
    </DashboardCard>
  );
}
