import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Minus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type {
  AnalyticsExecutiveDashboardPayload,
  AnalyticsExecutiveInsight,
  AnalyticsExecutiveScore,
  AnalyticsModuleCoverageRow,
  AnalyticsConfidenceLevel,
  AnalyticsScoreBand,
} from "@/src/lib/analytics-os/analyticsExecutiveTypes";

function bandBadgeClass(band: AnalyticsScoreBand): string {
  switch (band) {
    case "excellent":
      return "text-emerald-300 ring-emerald-500/35 bg-emerald-950/30";
    case "strong":
      return "text-sky-300 ring-sky-500/35 bg-sky-950/30";
    case "watch":
      return "text-amber-200 ring-amber-400/35 bg-amber-950/25";
    case "risk":
      return "text-orange-300 ring-orange-500/35 bg-orange-950/25";
    case "critical":
      return "text-rose-300 ring-rose-500/35 bg-rose-950/30";
  }
}

function bandLabel(band: AnalyticsScoreBand): string {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "watch":
      return "Watch";
    case "risk":
      return "At risk";
    case "critical":
      return "Critical";
  }
}

function insightSeverityClass(severity: AnalyticsExecutiveInsight["severity"]): string {
  switch (severity) {
    case "positive":
      return "border-emerald-500/30 bg-emerald-950/20";
    case "info":
      return "border-white/[0.08] bg-[#0c1220]/75";
    case "warning":
      return "border-amber-500/30 bg-amber-950/20";
    case "risk":
      return "border-orange-500/35 bg-orange-950/20";
    case "critical":
      return "border-rose-500/35 bg-rose-950/25";
  }
}

function coverageStatusClass(status: AnalyticsModuleCoverageRow["status"]): string {
  if (status === "active") return "text-emerald-300 ring-emerald-500/30";
  if (status === "limited") return "text-amber-200 ring-amber-400/35";
  return "text-slate-400 ring-white/10";
}

function coverageStatusLabel(status: AnalyticsModuleCoverageRow["status"]): string {
  if (status === "active") return "Active";
  if (status === "limited") return "Limited";
  return "Waiting";
}

function analyticsConfidenceClass(level: AnalyticsConfidenceLevel): string {
  if (level === "high") return "text-emerald-300 ring-emerald-500/35 bg-emerald-950/30";
  if (level === "medium") return "text-sky-300 ring-sky-500/35 bg-sky-950/30";
  return "text-amber-200 ring-amber-400/35 bg-amber-950/25";
}

function analyticsConfidenceLabel(level: AnalyticsConfidenceLevel): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function formatPeriodDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ScoreCard({ score }: { score: AnalyticsExecutiveScore }) {
  const pct = Math.max(0, Math.min(100, score.score));

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#F8FAFC]">{score.label}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${bandBadgeClass(score.band)}`}
        >
          {bandLabel(score.band)}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{score.score}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#22C1FF]/70 to-[#7C3AED]/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">{score.explanation}</p>
      {score.limitedSignal ? (
        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-amber-300/90">Limited signal</p>
      ) : null}
    </div>
  );
}

function MetricDirectionIcon({ direction }: { direction: "up" | "down" | "flat" | "unknown" }) {
  if (direction === "up") return <ArrowUpRight className="h-4 w-4 text-emerald-400" aria-hidden />;
  if (direction === "down") return <ArrowDownRight className="h-4 w-4 text-amber-400" aria-hidden />;
  if (direction === "flat") return <Minus className="h-4 w-4 text-slate-400" aria-hidden />;
  return <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />;
}

export function AnalyticsExecutiveIntelligence({ model }: { model: AnalyticsExecutiveDashboardPayload }) {
  const { snapshot, loadNotes } = model;
  const overall = snapshot.overallClinicHealthScore;

  const scoreGrid = [
    snapshot.revenueEfficiencyScore,
    snapshot.workforceReadinessScore,
    snapshot.conversionPerformanceScore,
    snapshot.surgicalEfficiencyScore,
    snapshot.patientJourneyScore,
    snapshot.dataCompletenessScore,
  ];

  return (
    <div className="space-y-8">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_240px_at_0%_0%,rgba(124,58,237,0.12),transparent_55%),radial-gradient(480px_220px_at_100%_100%,rgba(34,193,255,0.1),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 border-l-4 border-[#7C3AED]/70 pl-5 sm:pl-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#A78BFA]/95">Phase B+C</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">
              Executive Intelligence Engine
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#94A3B8]">
              Cross-module operational health scores, trends, and deterministic insights from the AnalyticsOS event
              pipeline.
            </p>
            <p className="mt-2 text-xs text-[#64748B]">
              Period: {formatPeriodDate(snapshot.periodStart)} – {formatPeriodDate(snapshot.periodEnd)}
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${analyticsConfidenceClass(snapshot.analyticsConfidence)}`}
            >
              Analytics confidence: {analyticsConfidenceLabel(snapshot.analyticsConfidence)}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-center rounded-2xl border border-white/[0.1] bg-[#0c1220]/80 px-8 py-6 text-center">
            <Brain className="h-8 w-8 text-[#22C1FF]" aria-hidden />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Clinic health score</p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-[#F8FAFC]">{overall.score}</p>
            <span
              className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${bandBadgeClass(overall.band)}`}
            >
              {bandLabel(overall.band)}
            </span>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Scores"
          title="Executive score grid"
          description="Deterministic v1 scoring from fi_analytics_events and module readiness signals."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scoreGrid.map((score) => (
            <ScoreCard key={score.label} score={score} />
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Metrics"
          title="Key operational metrics"
          description="Aggregate counts and period-over-period change — no raw event metadata."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {snapshot.metrics.map((metric) => (
            <StatCard
              key={metric.key}
              label={metric.label}
              value={
                metric.changePercent != null
                  ? `${metric.value} (${metric.changePercent >= 0 ? "+" : ""}${metric.changePercent}%)`
                  : metric.value
              }
              icon={<MetricDirectionIcon direction={metric.direction} />}
            />
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Insights"
          title="Insights and recommended actions"
          description="Rule-based executive signals — no AI inference."
          className="mb-4"
        />
        {snapshot.insights.length ? (
          <ul className="space-y-3">
            {snapshot.insights.map((insight) => (
              <li
                key={insight.id}
                className={`rounded-xl border px-4 py-3 ${insightSeverityClass(insight.severity)}`}
              >
                <div className="flex items-start gap-3">
                  {insight.severity === "positive" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  ) : insight.severity === "critical" || insight.severity === "risk" ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden />
                  ) : insight.severity === "warning" ? (
                    <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                  ) : (
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#22C1FF]" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F8FAFC]">{insight.title}</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">{insight.description}</p>
                    <p className="mt-2 text-xs text-[#CBD5E1]">
                      <span className="font-medium text-[#64748B]">Recommended: </span>
                      {insight.recommendedAction}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-[#64748B]">
                      Sources: {insight.sourceModules.join(", ") || "—"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#94A3B8]">No executive insights for the selected period.</p>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Pipeline"
          title="Module event coverage"
          description="Which FI OS modules are feeding AnalyticsOS this period (Active >20 events, Limited 1–19, Waiting 0)."
          className="mb-4"
        />
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.08] bg-[#0c1220]/90 text-xs uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Event count</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.moduleCoverage.map((row) => (
                <tr key={row.moduleName} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#F8FAFC]">{row.displayLabel}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${coverageStatusClass(row.status)}`}
                    >
                      {coverageStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                    {row.eventCount} event{row.eventCount === 1 ? "" : "s"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.moduleCoverage.map((row) =>
            row.lastEventAt ? (
              <p key={`${row.moduleName}-last`} className="text-xs text-[#64748B]">
                {row.displayLabel} last event: {formatPeriodDate(row.lastEventAt)}
              </p>
            ) : null
          )}
        </div>
      </DashboardCard>

      {loadNotes.length ? (
        <DashboardCard className="border-amber-500/25 bg-amber-950/20 p-5 sm:p-6">
          <div className="flex gap-2">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-200/90" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-100">Executive load notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-50/90">
                {loadNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <p>
            Executive intelligence uses aggregate event counts and scores only. Raw event metadata is not exposed in
            this view.
          </p>
          <Activity className="ml-auto h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </div>
      </DashboardCard>
    </div>
  );
}
