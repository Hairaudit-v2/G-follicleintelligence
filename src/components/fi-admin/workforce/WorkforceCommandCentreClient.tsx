"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { applyRecommendedProcedureTeamAction } from "@/src/lib/actions/workforce-phase-2-sprint-4-actions";
import { refreshWorkforcePlanningAction } from "@/src/lib/actions/workforce-phase-2-sprint-5-actions";
import { formatCentsAsCurrency } from "@/src/lib/workforce/wageProfileCore";
import type { WorkforceCommandCentrePageData } from "@/src/lib/workforce/workforceCommandCentrePage.server";
import {
  buildEmptyPlanningFallbackMessage,
  healthStatusBadgeClass,
  healthStatusLabel,
  severityBadgeClass,
  type WorkforceAttentionQueueItem,
  type WorkforceAttentionSeverity,
  type WorkforceHealthMetric,
  type SurgicalWorkforceIntelligencePanel,
  type WorkforceIntelligencePanel,
  type WorkforceModuleTile,
} from "@/src/lib/workforce/workforceCommandCentreCore";
import type { WorkforceIntelligenceStatus } from "@/src/lib/workforce/workforceIntelligenceEngineCore";
import type {
  SurgicalIntelligenceAction,
  SurgicalReadinessStatus,
} from "@/src/lib/workforce/surgicalWorkforceIntelligenceCore";
import { cn } from "@/lib/utils";
import { StaffUatClarityFeedback } from "@/src/components/fi-admin/staff-uat/StaffUatClarityFeedback";
import { StaffUatScreenGuide } from "@/src/components/fi-admin/staff-uat/StaffUatScreenGuide";

const UTILITY_MODULE_IDS = new Set([
  "recruitment",
  "compliance",
  "credentials",
  "payroll",
  "staff-directory",
  "hr-reconciliation",
]);

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  kicker,
  title,
  description,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <header className={cn("space-y-2", className)}>
      {kicker ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#22C1FF]/90">
          {kicker}
        </p>
      ) : null}
      <h2 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">{title}</h2>
      {description ? (
        <p className="max-w-3xl text-sm leading-relaxed text-[#64748B] sm:text-[15px]">{description}</p>
      ) : null}
    </header>
  );
}

function ExecutiveKpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="group flex min-h-[8.5rem] flex-col justify-center rounded-2xl border border-white/[0.1] bg-[#0c1426]/90 px-6 py-8 shadow-xl shadow-black/50 backdrop-blur-sm transition-all duration-200 hover:border-[#22C1FF]/30 hover:bg-[#0c1426] hover:shadow-2xl hover:shadow-[#22C1FF]/5">
      <div className="text-4xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-5xl xl:text-[3.25rem]">
        {value}
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B] transition-colors group-hover:text-[#94A3B8]">
        {label}
      </div>
    </div>
  );
}

function tileBadgeClass(variant: WorkforceModuleTile["statusBadge"]["variant"]): string {
  switch (variant) {
    case "success":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "warning":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    case "danger":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
    default:
      return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  }
}

function intelligenceStatusBadgeClass(status: WorkforceIntelligenceStatus): string {
  switch (status) {
    case "excellent":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "stable":
      return "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25";
    case "watch":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    default:
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
  }
}

function surgicalStatusBadgeClass(status: SurgicalReadinessStatus): string {
  switch (status) {
    case "optimal":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "watch":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    default:
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
  }
}

function surgicalStatusLabel(status: SurgicalReadinessStatus): string {
  switch (status) {
    case "optimal":
      return "Optimal";
    case "watch":
      return "Watch";
    default:
      return "Risk";
  }
}

function intelligenceStatusLabel(status: WorkforceIntelligenceStatus): string {
  switch (status) {
    case "excellent":
      return "Excellent";
    case "stable":
      return "Stable";
    case "watch":
      return "Watch";
    default:
      return "Critical";
  }
}

function severityAccentClass(severity: WorkforceAttentionSeverity): string {
  switch (severity) {
    case "critical":
      return "border-l-rose-500 bg-rose-500/[0.05] shadow-rose-500/10";
    case "high":
      return "border-l-amber-400 bg-amber-500/[0.05] shadow-amber-500/10";
    case "medium":
      return "border-l-[#22C1FF] bg-[#22C1FF]/[0.04] shadow-[#22C1FF]/10";
    default:
      return "border-l-slate-500 bg-white/[0.02] shadow-black/20";
  }
}

function extractQueueCount(item: WorkforceAttentionQueueItem): number | null {
  const explanationMatch = item.explanation.match(/^(\d+)/);
  if (explanationMatch) return Number.parseInt(explanationMatch[1], 10);
  const titleMatch = item.title.match(/^(\d+)/);
  if (titleMatch) return Number.parseInt(titleMatch[1], 10);
  return null;
}

function formatQueueHeadline(item: WorkforceAttentionQueueItem): string {
  const count = extractQueueCount(item);
  if (count != null) {
    return `${count} ${item.title}`;
  }
  return item.title;
}

function HealthBar({ metric }: { metric: WorkforceHealthMetric }) {
  const pct = metric.scorePercent ?? 0;
  return (
    <Link
      href={metric.href}
      className="group block rounded-2xl border border-white/[0.09] bg-[#0c1426]/80 p-5 shadow-lg shadow-black/35 transition-all duration-200 hover:border-[#22C1FF]/30 hover:bg-[#0c1426] hover:shadow-xl hover:shadow-[#22C1FF]/5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[#F8FAFC]">{metric.label}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">{metric.explanation}</p>
        </div>
        <Badge className={healthStatusBadgeClass(metric.status)}>
          {healthStatusLabel(metric.status)}
        </Badge>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-medium text-[#94A3B8]">
          <span>Score</span>
          <span className="tabular-nums text-sm text-[#CBD5E1]">
            {metric.scorePercent != null ? `${metric.scorePercent}%` : "—"}
          </span>
        </div>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              metric.status === "excellent" || metric.status === "good"
                ? "bg-gradient-to-r from-[#22C1FF] to-emerald-400"
                : metric.status === "attention"
                  ? "bg-amber-400"
                  : metric.status === "critical"
                    ? "bg-rose-500"
                    : "bg-slate-600"
            )}
            style={{ width: `${Math.min(100, Math.max(metric.scorePercent != null ? pct : 0, 4))}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function UtilityModuleCard({ tile }: { tile: WorkforceModuleTile }) {
  return (
    <DashboardCard
      className="flex h-full flex-col p-4 transition-all duration-200 hover:border-[#22C1FF]/25 hover:shadow-lg hover:shadow-[#22C1FF]/5 sm:p-5"
      elevated
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#F8FAFC]">{tile.name}</h3>
        <Badge className={tileBadgeClass(tile.statusBadge.variant)}>{tile.statusBadge.label}</Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#64748B] line-clamp-2">{tile.valueProposition}</p>
      <p className="mt-3 text-xs font-medium text-[#94A3B8]">{tile.keyMetric}</p>
      <div className="mt-auto pt-4">
        <Link
          href={tile.href}
          className="inline-flex items-center rounded-lg border border-[#22C1FF]/25 bg-[#22C1FF]/10 px-3 py-2 text-xs font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/45 hover:bg-[#22C1FF]/18 hover:shadow-md hover:shadow-[#22C1FF]/10"
        >
          {tile.ctaLabel} →
        </Link>
      </div>
    </DashboardCard>
  );
}

function AttentionItem({ item }: { item: WorkforceAttentionQueueItem }) {
  const count = extractQueueCount(item);
  const headline = formatQueueHeadline(item);

  return (
    <li>
      <div
        className={cn(
          "flex flex-col gap-5 rounded-2xl border border-white/[0.09] border-l-4 p-5 shadow-lg transition-all duration-200 hover:border-white/[0.14] hover:shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-6",
          severityAccentClass(item.severity)
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-4 sm:gap-5">
            {count != null ? (
              <span className="shrink-0 text-4xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-5xl">
                {count}
              </span>
            ) : null}
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge className={severityBadgeClass(item.severity)}>{item.severity}</Badge>
                <p className="text-base font-semibold text-[#F8FAFC] sm:text-lg">
                  {count != null ? item.title : headline}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-[#94A3B8]">{item.explanation}</p>
            </div>
          </div>
        </div>
        <Link
          href={item.href}
          className="shrink-0 rounded-xl border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-4 py-2.5 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/50 hover:bg-[#22C1FF]/18 hover:shadow-md hover:shadow-[#22C1FF]/10"
        >
          {item.recommendedAction}
        </Link>
      </div>
    </li>
  );
}

const heroPrimaryButtonClass =
  "rounded-xl border border-[#22C1FF]/45 bg-[#22C1FF]/15 px-5 py-3 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/65 hover:bg-[#22C1FF]/22 hover:shadow-lg hover:shadow-[#22C1FF]/15";

const heroSecondaryButtonClass =
  "rounded-xl border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-medium text-[#CBD5E1] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06] hover:text-[#F8FAFC] hover:shadow-md hover:shadow-black/30";

function IntelligenceScoreRing({
  score,
  label,
  status,
}: {
  score: number;
  label: string;
  status: WorkforceIntelligenceStatus;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#0B1220]/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">{label}</p>
        <Badge className={intelligenceStatusBadgeClass(status)}>{intelligenceStatusLabel(status)}</Badge>
      </div>
      <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-5xl">{score}</p>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            status === "excellent" || status === "stable"
              ? "bg-gradient-to-r from-[#22C1FF] to-emerald-400"
              : status === "watch"
                ? "bg-amber-400"
                : "bg-rose-500"
          )}
          style={{ width: `${Math.min(100, Math.max(score, 4))}%` }}
        />
      </div>
    </div>
  );
}

function WorkforceIntelligenceEngineSection({
  intelligence,
  canManage,
  pending,
  message,
  error,
  onRefreshPlanning,
}: {
  intelligence: WorkforceIntelligencePanel;
  canManage: boolean;
  pending: boolean;
  message: string | null;
  error: string | null;
  onRefreshPlanning: () => void;
}) {
  const { overallHealth, tomorrowReadiness, forecast, executiveRecommendations } = intelligence;
  const topRecommendations = executiveRecommendations.slice(0, 3);

  return (
    <section aria-label="Workforce intelligence engine" className="space-y-5">
      <SectionHeading
        kicker="Intelligence"
        title="Workforce Intelligence Engine"
        description="Predictive workforce risk, readiness, and ranked executive actions — FI interprets what matters next."
      />
      <DashboardCard elevated className="relative overflow-hidden border-[#22C1FF]/15 p-6 shadow-2xl shadow-black/55 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_220px_at_100%_0%,rgba(34,193,255,0.08),transparent_60%)]"
          aria-hidden
        />
        <div className="relative space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <IntelligenceScoreRing
                score={overallHealth.score}
                label="Overall Workforce Health"
                status={overallHealth.status}
              />
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{overallHealth.summary}</p>
              {overallHealth.contributingFactors.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {overallHealth.contributingFactors.slice(0, 3).map((factor) => (
                    <li
                      key={factor.label}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#0B1220]/50 px-3 py-2 text-xs"
                    >
                      <span className="text-[#CBD5E1]">{factor.label}</span>
                      <span className="font-semibold tabular-nums text-rose-300">{factor.impact}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-[#0B1220]/60 p-5 sm:p-6 lg:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Tomorrow Surgery Readiness
                </p>
                <Badge className={intelligenceStatusBadgeClass(tomorrowReadiness.status)}>
                  {intelligenceStatusLabel(tomorrowReadiness.status)}
                </Badge>
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-[#F8FAFC]">
                {tomorrowReadiness.readinessScore}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{tomorrowReadiness.summary}</p>
              {tomorrowReadiness.available && tomorrowReadiness.understaffed + tomorrowReadiness.credentialWarnings > 0 ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Staffing gaps</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-amber-200">
                      {tomorrowReadiness.understaffed}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Credential warnings</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-rose-300">
                      {tomorrowReadiness.credentialWarnings}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-[#0B1220]/60 p-5 sm:p-6 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Predictive Staffing Forecast
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#64748B]">7-day score</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-[#F8FAFC]">{forecast.sevenDayScore}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#64748B]">14-day score</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-[#F8FAFC]">{forecast.fourteenDayScore}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#94A3B8]">{forecast.summary}</p>
              {forecast.staffingGapSignals.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-xs text-[#94A3B8]">
                  {forecast.staffingGapSignals.slice(0, 2).map((signal) => (
                    <li key={signal} className="rounded-md border border-white/[0.05] bg-[#0B1220]/40 px-2.5 py-1.5">
                      {signal}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#64748B]">
              Executive Recommendations
            </h3>
            {topRecommendations.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {topRecommendations.map((rec, idx) => (
                  <li
                    key={rec.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0B1220]/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-bold tabular-nums text-[#64748B]">#{idx + 1}</span>
                        <Badge className={severityBadgeClass(rec.severity)}>{rec.severity}</Badge>
                        <Badge className="bg-white/[0.04] text-[#94A3B8] ring-white/10">{rec.impact} impact</Badge>
                      </div>
                      <p className="mt-2 text-base font-semibold text-[#F8FAFC]">{rec.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#94A3B8]">{rec.description}</p>
                    </div>
                    <Link
                      href={rec.route}
                      className="shrink-0 rounded-xl border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-4 py-2.5 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/50 hover:bg-[#22C1FF]/18"
                    >
                      {rec.ctaLabel} →
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0B1220]/50 px-6 py-5 text-sm leading-relaxed text-[#94A3B8]">
                {buildEmptyPlanningFallbackMessage()}
              </p>
            )}
          </div>

          {canManage ? (
            <Button
              type="button"
              className="h-11 w-full text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-[#22C1FF]/10 sm:w-auto sm:px-8"
              disabled={pending}
              onClick={onRefreshPlanning}
            >
              {pending ? "Refreshing…" : "Refresh Planning Signals"}
            </Button>
          ) : null}
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </DashboardCard>
    </section>
  );
}

const surgicalActionButtonClass =
  "inline-flex items-center rounded-xl border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-3.5 py-2 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/50 hover:bg-[#22C1FF]/18 disabled:cursor-not-allowed disabled:opacity-50";

const surgicalSecondaryButtonClass =
  "inline-flex items-center rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-[#CBD5E1] transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06] hover:text-[#F8FAFC]";

function SurgicalIntelligenceActionButtons({
  actions,
  canManage,
  applyingSurgeryId,
  onApplyRecommendedTeam,
}: {
  actions: SurgicalIntelligenceAction[];
  canManage: boolean;
  applyingSurgeryId: string | null;
  onApplyRecommendedTeam: (surgeryId: string) => void;
}) {
  if (actions.length === 0) return null;

  const primary = actions[0];
  const secondary = actions.slice(1, 3);

  return (
    <div className="flex flex-wrap gap-2">
      {primary?.type === "apply_recommended_team" && primary.surgeryId && canManage ? (
        <Button
          type="button"
          size="sm"
          className="h-9 px-4 text-sm font-semibold"
          disabled={applyingSurgeryId != null}
          onClick={() => onApplyRecommendedTeam(primary.surgeryId!)}
        >
          {applyingSurgeryId === primary.surgeryId ? "Applying…" : primary.label}
        </Button>
      ) : (
        <Link href={primary.route} className={surgicalActionButtonClass}>
          {primary.label} →
        </Link>
      )}
      {secondary.map((action) =>
        action.type === "apply_recommended_team" && action.surgeryId && canManage ? (
          <Button
            key={`${action.type}-${action.surgeryId}`}
            type="button"
            size="sm"
            variant="outline"
            className="h-9 border-white/12 bg-transparent px-3.5 text-sm text-[#CBD5E1] hover:bg-white/[0.06]"
            disabled={applyingSurgeryId != null}
            onClick={() => onApplyRecommendedTeam(action.surgeryId!)}
          >
            {applyingSurgeryId === action.surgeryId ? "Applying…" : action.label}
          </Button>
        ) : (
          <Link
            key={`${action.type}-${action.route}`}
            href={action.route}
            className={surgicalSecondaryButtonClass}
          >
            {action.label} →
          </Link>
        )
      )}
    </div>
  );
}

function SurgicalWorkforceIntelligenceSection({
  tenantId,
  surgicalIntelligence,
  canManage,
}: {
  tenantId: string;
  surgicalIntelligence: SurgicalWorkforceIntelligencePanel;
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [applyingSurgeryId, setApplyingSurgeryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    tomorrowDate,
    tomorrowReadiness,
    staffingQuality,
    clinicalCapacity,
    staffingRisks,
    recommendations,
    actionableProcedures,
  } = surgicalIntelligence;
  const topRisks = staffingRisks.detectedRisks.slice(0, 3);
  const topRecommendations = recommendations.slice(0, 3);
  const tomorrowAtRisk = actionableProcedures
    .filter((proc) => proc.procedureDate === tomorrowDate)
    .slice(0, 2);

  function onApplyRecommendedTeam(surgeryId: string) {
    setMessage(null);
    setError(null);
    setApplyingSurgeryId(surgeryId);
    startTransition(async () => {
      const res = await applyRecommendedProcedureTeamAction(tenantId, surgeryId);
      setApplyingSurgeryId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `Applied ${res.assignedCount} assignment(s) for procedure team. Skipped ${res.skippedCount}.`
      );
      router.refresh();
    });
  }

  return (
    <section aria-label="Surgical workforce intelligence" className="space-y-5">
      <SectionHeading
        kicker="SurgeryOS"
        title="Surgical Workforce Intelligence"
        description="Clinical procedure staffing intelligence — assignment safety, surgical capacity, and operational risk across upcoming procedures."
      />
      <DashboardCard elevated className="relative overflow-hidden border-[#22C1FF]/15 p-6 shadow-2xl shadow-black/55 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_220px_at_100%_0%,rgba(34,193,255,0.06),transparent_60%)]"
          aria-hidden
        />
        <div className="relative space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.09] bg-[#0B1220]/60 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Tomorrow Clinical Readiness
                </p>
                <Badge className={surgicalStatusBadgeClass(tomorrowReadiness.status)}>
                  {surgicalStatusLabel(tomorrowReadiness.status)}
                </Badge>
              </div>
              <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-5xl">
                {tomorrowReadiness.readinessScore}%
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{tomorrowReadiness.summary}</p>
              {tomorrowReadiness.surgeriesScheduled > 0 ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Scheduled</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-[#F8FAFC]">
                      {tomorrowReadiness.surgeriesScheduled}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">At risk</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-amber-200">{tomorrowReadiness.atRisk}</dd>
                  </div>
                </dl>
              ) : null}
              {tomorrowAtRisk.length > 0 ? (
                <ul className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                  {tomorrowAtRisk.map((proc) => (
                    <li key={proc.surgeryId} className="space-y-2">
                      <p className="text-sm font-medium text-[#F8FAFC]">{proc.procedureLabel}</p>
                      <SurgicalIntelligenceActionButtons
                        actions={proc.actions}
                        canManage={canManage}
                        applyingSurgeryId={applyingSurgeryId}
                        onApplyRecommendedTeam={onApplyRecommendedTeam}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-[#0B1220]/60 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Procedure Staffing Quality
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-[#64748B]">Assignment Quality</p>
              <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-5xl">
                {staffingQuality.staffingQualityScore}%
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{staffingQuality.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Accuracy</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-[#CBD5E1]">
                    {staffingQuality.assignmentAccuracy}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Unsafe</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-rose-300">
                    {staffingQuality.unsafeAssignments}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-[#0B1220]/60 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Weekly Clinical Capacity
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-[#64748B]">Capacity Utilization</p>
              <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-[#F8FAFC] sm:text-5xl">
                {clinicalCapacity.weeklyCapacityPercent}%
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{clinicalCapacity.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Unused hours</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-[#22C1FF]">
                    {Math.round(clinicalCapacity.unusedHours)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#64748B]">Overload risk</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-amber-200">{clinicalCapacity.overloadRisk}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border-t border-white/[0.06] pt-6 lg:border-t-0 lg:pt-0">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Surgical Staffing Risks
              </h3>
              {topRisks.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {topRisks.map((risk) => (
                    <li
                      key={risk.id}
                      className={cn(
                        "rounded-2xl border border-white/[0.08] border-l-4 bg-[#0B1220]/60 p-4",
                        risk.severity === "critical" ? "border-l-rose-500" : "border-l-amber-400"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            risk.severity === "critical"
                              ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
                              : "bg-amber-500/15 text-amber-200 ring-amber-500/25"
                          }
                        >
                          {risk.severity}
                        </Badge>
                        <p className="text-sm font-semibold text-[#F8FAFC]">{risk.title}</p>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">{risk.recommendation}</p>
                      <div className="mt-3">
                        <SurgicalIntelligenceActionButtons
                          actions={risk.actions}
                          canManage={canManage}
                          applyingSurgeryId={applyingSurgeryId}
                          onApplyRecommendedTeam={onApplyRecommendedTeam}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0B1220]/50 px-5 py-4 text-sm text-[#94A3B8]">
                  No surgical staffing risks detected in the current planning horizon.
                </p>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-6 lg:border-t-0 lg:pt-0">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Procedure Recommendations
              </h3>
              {topRecommendations.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {topRecommendations.map((rec, idx) => (
                    <li
                      key={rec.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0B1220]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold tabular-nums text-[#64748B]">#{idx + 1}</span>
                          <Badge className={severityBadgeClass(rec.severity)}>{rec.severity}</Badge>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#F8FAFC]">{rec.title}</p>
                      </div>
                      <SurgicalIntelligenceActionButtons
                        actions={rec.actions}
                        canManage={canManage}
                        applyingSurgeryId={applyingSurgeryId}
                        onApplyRecommendedTeam={onApplyRecommendedTeam}
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0B1220]/50 px-5 py-4 text-sm text-[#94A3B8]">
                  No procedure staffing recommendations at this time.
                </p>
              )}
            </div>
          </div>

          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </DashboardCard>
    </section>
  );
}

export function WorkforceCommandCentreClient({
  tenantId,
  data,
}: {
  tenantId: string;
  data: WorkforceCommandCentrePageData;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    kpis,
    healthRadar,
    attentionQueue,
    moduleTiles,
    procedureForecast,
    financialIntelligence,
    intelligence,
    surgicalIntelligence,
    canManage,
  } = data;

  const utilityTiles = moduleTiles.filter((tile) => UTILITY_MODULE_IDS.has(tile.id));

  function onRefreshPlanning() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await refreshWorkforcePlanningAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Planning signals refreshed.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-10 pb-10 sm:space-y-12 sm:pb-14">
      <StaffUatScreenGuide screenKey="workforce_os" />
      <header className="relative overflow-hidden rounded-2xl border border-[#22C1FF]/25 bg-gradient-to-br from-[#0c1426] via-[#0f1a30] to-[#0a1020] p-8 shadow-2xl shadow-black/50 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_320px_at_0%_0%,rgba(34,193,255,0.14),transparent_55%),radial-gradient(480px_240px_at_100%_100%,rgba(124,58,237,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#22C1FF]/10 blur-3xl" />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-6 sm:pl-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#22C1FF]/90 sm:text-sm">
                WorkforceOS · Intelligence Centre
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-[#F8FAFC] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Workforce Intelligence Centre
              </h1>
              <p className="text-base leading-relaxed text-[#94A3B8] sm:text-lg sm:leading-8">
                Real-time workforce intelligence across staffing readiness, surgical workforce allocation,
                compliance monitoring, payroll exposure, and operational workforce performance.
              </p>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-3">
                <Link href={`${base}/planning`} className={heroPrimaryButtonClass}>
                  Open Workforce Planning
                </Link>
                <Link href={`${base}/procedure-staffing`} className={heroSecondaryButtonClass}>
                  Procedure Staffing
                </Link>
                <Link href={`${base}/payroll`} className={heroSecondaryButtonClass}>
                  Payroll & Wages
                </Link>
                <Link href={`${base}/hr-reconciliation`} className={heroSecondaryButtonClass}>
                  HR Reconciliation
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-label="Executive KPIs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <ExecutiveKpiCard label="Total Staff" value={kpis.totalStaff} />
        <ExecutiveKpiCard label="Clinically Eligible" value={kpis.clinicallyEligible} />
        <ExecutiveKpiCard label="Credential Risks" value={kpis.credentialRisks} />
        <ExecutiveKpiCard label="Open Recruitment" value={kpis.openRecruitment} />
        <ExecutiveKpiCard label="Procedure Gaps" value={kpis.upcomingProcedureGaps} />
        <ExecutiveKpiCard
          label="Weekly Wage Exposure"
          value={formatCentsAsCurrency(kpis.weeklyWageExposureCents)}
        />
      </section>

      <WorkforceIntelligenceEngineSection
        intelligence={intelligence}
        canManage={canManage}
        pending={pending}
        message={message}
        error={error}
        onRefreshPlanning={onRefreshPlanning}
      />

      <SurgicalWorkforceIntelligenceSection
        tenantId={tenantId}
        surgicalIntelligence={surgicalIntelligence}
        canManage={canManage}
      />

      <section aria-label="Workforce priority queue" className="space-y-5">
        <SectionHeading
          kicker="Operations"
          title="Workforce Priority Queue"
          description="Highest-priority workforce issues ranked by severity and planning signals — your operational command surface."
        />
        <DashboardCard elevated className="relative overflow-hidden border-[#22C1FF]/15 p-6 shadow-2xl shadow-black/55 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_220px_at_0%_0%,rgba(34,193,255,0.08),transparent_60%)]"
            aria-hidden
          />
          {attentionQueue.length === 0 ? (
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#0B1220]/60 px-8 py-12 text-center">
              <p className="text-base text-[#94A3B8]">
                No urgent workforce issues detected. Monitor planning signals for changes.
              </p>
            </div>
          ) : (
            <ul className="relative space-y-3 sm:space-y-4">
              {attentionQueue.map((item) => (
                <AttentionItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </DashboardCard>
      </section>

      <section aria-label="Workforce health radar" className="space-y-5">
        <SectionHeading
          kicker="Health"
          title="Workforce Health Radar"
          description="Operational readiness across compliance, staffing, recruitment, and payroll."
        />
        <DashboardCard className="p-6 shadow-xl shadow-black/45 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {healthRadar.map((metric) => (
              <HealthBar key={metric.id} metric={metric} />
            ))}
          </div>
        </DashboardCard>
      </section>

      <section aria-label="Procedure staffing forecast" className="space-y-5">
        <SectionHeading
          kicker="Forecast"
          title="Procedure Staffing Forecast"
          description={
            procedureForecast.available
              ? `Planning horizon ${procedureForecast.horizonStart} → ${procedureForecast.horizonEnd}`
              : "Planning horizon unavailable"
          }
        />
        <DashboardCard elevated className="p-6 shadow-xl shadow-black/45 sm:p-8">
          {procedureForecast.available ? (
            <>
              <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Scheduled</dt>
                  <dd className="mt-2 text-3xl font-bold tabular-nums text-[#F8FAFC]">
                    {procedureForecast.scheduledProcedures}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Fully staffed</dt>
                  <dd className="mt-2 text-3xl font-bold tabular-nums text-emerald-300">
                    {procedureForecast.fullyStaffedProcedures}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Understaffed</dt>
                  <dd className="mt-2 text-3xl font-bold tabular-nums text-amber-200">
                    {procedureForecast.understaffedProcedures}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                    Credential warnings
                  </dt>
                  <dd className="mt-2 text-3xl font-bold tabular-nums text-rose-300">
                    {procedureForecast.credentialWarnings}
                  </dd>
                </div>
              </dl>
              {procedureForecast.missingRoles.length > 0 ? (
                <div className="mt-6 border-t border-white/[0.06] pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Missing roles</p>
                  <ul className="mt-3 flex flex-wrap gap-2.5">
                    {procedureForecast.missingRoles.map((r) => (
                      <li
                        key={r.role}
                        className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-100"
                      >
                        {r.role} · {r.gap}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-[#94A3B8]">{buildEmptyPlanningFallbackMessage()}</p>
          )}
          <Link
            href={`${base}/procedure-staffing`}
            className="mt-6 inline-flex items-center rounded-xl border border-[#22C1FF]/25 bg-[#22C1FF]/10 px-4 py-2.5 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/45 hover:bg-[#22C1FF]/18 hover:shadow-md hover:shadow-[#22C1FF]/10"
          >
            Open procedure staffing →
          </Link>
        </DashboardCard>
      </section>

      <section aria-label="Intelligence modules" className="space-y-5">
        <SectionHeading
          kicker="Modules"
          title="Workforce Operations"
          description="Quick access to recruitment, compliance, credentials, payroll, directory, and HR reconciliation."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {utilityTiles.map((tile) => (
            <UtilityModuleCard key={tile.id} tile={tile} />
          ))}
        </div>
      </section>

      <section aria-label="Financial intelligence" className="space-y-5">
        <SectionHeading
          kicker="Finance"
          title="Workforce Financial Intelligence"
          description="Commercial labour cost visibility across roster, procedures, and weekly exposure."
        />
        <DashboardCard elevated className="p-6 shadow-xl shadow-black/45 sm:p-8">
          {financialIntelligence.available ? (
            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Weekly exposure</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-[#22C1FF] sm:text-3xl">
                  {formatCentsAsCurrency(financialIntelligence.weeklyWageExposureCents)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Daily roster cost</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-[#F8FAFC] sm:text-3xl">
                  {formatCentsAsCurrency(financialIntelligence.dailyRosterCostCents)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Procedure labour</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-[#F8FAFC] sm:text-3xl">
                  {formatCentsAsCurrency(financialIntelligence.procedureLabourCostCents)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Avg / procedure</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-[#F8FAFC] sm:text-3xl">
                  {financialIntelligence.averageCostPerProcedureCents != null
                    ? formatCentsAsCurrency(financialIntelligence.averageCostPerProcedureCents)
                    : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Missing wage profiles
                </dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-amber-200 sm:text-3xl">
                  {financialIntelligence.missingWageProfileCount}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              Financial intelligence unavailable — configure wage profiles and roster shifts.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`${base}/payroll`}
              className="inline-flex items-center rounded-xl border border-[#22C1FF]/25 bg-[#22C1FF]/10 px-4 py-2.5 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/45 hover:bg-[#22C1FF]/18"
            >
              Payroll & wages →
            </Link>
            <Link
              href={`${base}/shift-cost`}
              className="inline-flex items-center rounded-xl border border-[#22C1FF]/25 bg-[#22C1FF]/10 px-4 py-2.5 text-sm font-semibold text-[#22C1FF] transition-all duration-200 hover:border-[#22C1FF]/45 hover:bg-[#22C1FF]/18"
            >
              Shift cost intelligence →
            </Link>
          </div>
        </DashboardCard>
      </section>

      <StaffUatClarityFeedback screenKey="workforce_os" />

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-8 text-sm text-[#64748B]">
        <p>
          Workforce members lifecycle view available at{" "}
          <Link href={`${base}/directory`} className="font-medium text-[#22C1FF] hover:underline">
            workforce directory
          </Link>
          .
        </p>
        <Link href={`/fi-admin/${tenantId}/staff`} className="font-medium text-[#22C1FF] hover:underline">
          FI staff directory →
        </Link>
      </footer>
    </div>
  );
}