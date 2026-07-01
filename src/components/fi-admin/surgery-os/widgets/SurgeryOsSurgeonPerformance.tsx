import { AlertTriangle, BarChart3, ShieldAlert, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type {
  SurgeonConsistencySnapshot,
  SurgeonPerformanceSnapshot,
  SurgeonRiskPatternSnapshot,
  SurgeryBenchmarkSnapshot,
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

function gradeClass(grade: SurgeonPerformanceSnapshot["performanceGrade"]): string {
  switch (grade) {
    case "elite":
      return "text-emerald-300";
    case "excellent":
      return "text-cyan-300";
    case "strong":
      return "text-violet-300";
    case "watch":
      return "text-amber-300";
    case "poor":
      return "text-rose-300";
    default:
      return "text-slate-300";
  }
}

function gradeLabel(grade: SurgeonPerformanceSnapshot["performanceGrade"]): string {
  switch (grade) {
    case "elite":
      return "Elite";
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "watch":
      return "Watch";
    case "poor":
      return "Poor";
    default:
      return grade;
  }
}

function trendLabel(trend: SurgeonPerformanceSnapshot["trendDirection"]): string {
  switch (trend) {
    case "improving":
      return "Improving";
    case "declining":
      return "Declining";
    default:
      return "Stable";
  }
}

function trendClass(trend: SurgeonPerformanceSnapshot["trendDirection"]): string {
  switch (trend) {
    case "improving":
      return "text-emerald-300";
    case "declining":
      return "text-rose-300";
    default:
      return "text-slate-300";
  }
}

function benchmarkSummary(benchmark: SurgeryBenchmarkSnapshot | undefined): string {
  if (!benchmark) return "Benchmark data pending";
  if (benchmark.benchmarkStatus === "above_average") {
    const deviation = benchmark.deviationPercentages.extractionVelocity;
    if (deviation != null) {
      return `${Math.abs(deviation)}% above clinic average`;
    }
    return benchmark.summary;
  }
  if (benchmark.benchmarkStatus === "below_average") {
    return benchmark.summary;
  }
  return "At clinic average";
}

function SurgeonPerformanceCard({
  performance,
  benchmark,
  consistency,
  risks,
}: {
  performance: SurgeonPerformanceSnapshot;
  benchmark?: SurgeryBenchmarkSnapshot;
  consistency?: SurgeonConsistencySnapshot;
  risks?: SurgeonRiskPatternSnapshot;
}) {
  const topRisks = risks?.detectedPatterns.slice(0, 3) ?? [];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-100">{performance.surgeonName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {performance.proceduresCompleted} completed procedure(s)
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Surgeon Score
          </p>
          <p className={cn("text-2xl font-semibold tabular-nums", gradeClass(performance.performanceGrade))}>
            {performance.performanceScore}%
          </p>
          <p className={cn("text-xs font-semibold uppercase tracking-wider", gradeClass(performance.performanceGrade))}>
            {gradeLabel(performance.performanceGrade)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          label="Extraction Velocity"
          value={
            performance.averageExtractionVelocity != null
              ? `${Math.round(performance.averageExtractionVelocity)}/hr`
              : "—"
          }
          accent="text-cyan-300"
        />
        <MetricTile
          label="Implantation Speed"
          value={
            performance.averageImplantationSpeed != null
              ? `${Math.round(performance.averageImplantationSpeed)}/hr`
              : "—"
          }
          accent="text-violet-300"
        />
        <MetricTile
          label="Transection Rate"
          value={
            performance.averageTransectionRate != null
              ? `${performance.averageTransectionRate}%`
              : "—"
          }
          accent="text-emerald-300"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Benchmark Comparison
          </p>
          <p className="mt-1 text-sm text-slate-200">{benchmarkSummary(benchmark)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Performance Trend
          </p>
          <p className={cn("mt-1 flex items-center gap-1.5 text-sm font-medium", trendClass(performance.trendDirection))}>
            <TrendingUp className="h-4 w-4" aria-hidden />
            {trendLabel(performance.trendDirection)}
          </p>
          {consistency ? (
            <p className="mt-1 text-xs text-slate-500">
              Consistency {consistency.consistencyScore}% · {consistency.status}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-300" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Risk Patterns
          </p>
        </div>
        {topRisks.length === 0 ? (
          <p className="text-sm text-slate-400">No surgeon performance risks detected.</p>
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

export function SurgeryOsSurgeonPerformanceWidget({
  surgeonPerformance = [],
  surgeryBenchmarks = [],
  surgeonConsistency = [],
  surgeonRiskPatterns = [],
}: {
  surgeonPerformance?: SurgeonPerformanceSnapshot[];
  surgeryBenchmarks?: SurgeryBenchmarkSnapshot[];
  surgeonConsistency?: SurgeonConsistencySnapshot[];
  surgeonRiskPatterns?: SurgeonRiskPatternSnapshot[];
}) {
  const benchmarkBySurgeon = new Map(surgeryBenchmarks.map((b) => [b.surgeonId, b]));
  const consistencyBySurgeon = new Map(surgeonConsistency.map((c) => [c.surgeonId, c]));
  const risksBySurgeon = new Map(surgeonRiskPatterns.map((r) => [r.surgeonId, r]));

  return (
    <DashboardCard className="flex h-full min-h-[360px] flex-col overflow-hidden xl:col-span-3">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Surgeon Performance Intelligence"
          description={`${surgeonPerformance.length} surgeon(s) · longitudinal quality, efficiency, benchmarks & risk patterns`}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {surgeonPerformance.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <BarChart3 className="mb-2 h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-400">No surgeon performance data available.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {surgeonPerformance.map((performance) => (
              <li key={performance.surgeonId}>
                <SurgeonPerformanceCard
                  performance={performance}
                  benchmark={benchmarkBySurgeon.get(performance.surgeonId)}
                  consistency={consistencyBySurgeon.get(performance.surgeonId)}
                  risks={risksBySurgeon.get(performance.surgeonId)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-white/[0.06] px-4 py-2">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          Surgeon performance intelligence · Sprint 3
        </p>
      </div>
    </DashboardCard>
  );
}
