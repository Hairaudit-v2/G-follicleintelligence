"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { StatCard } from "@/src/components/fi-admin/dashboard-ui/StatCard";
import { refreshWorkforcePlanningAction } from "@/src/lib/actions/workforce-phase-2-sprint-5-actions";
import { formatCentsAsCurrency } from "@/src/lib/workforce/wageProfileCore";
import type { WorkforceCommandCentrePageData } from "@/src/lib/workforce/workforceCommandCentrePage.server";
import {
  buildEmptyPlanningFallbackMessage,
  healthStatusBadgeClass,
  healthStatusLabel,
  severityBadgeClass,
  type WorkforceAttentionQueueItem,
  type WorkforceHealthMetric,
  type WorkforceModuleTile,
} from "@/src/lib/workforce/workforceCommandCentreCore";
import { cn } from "@/lib/utils";

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
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        className
      )}
    >
      {children}
    </span>
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

function HealthBar({ metric }: { metric: WorkforceHealthMetric }) {
  const pct = metric.scorePercent ?? 0;
  return (
    <Link
      href={metric.href}
      className="group block rounded-xl border border-white/[0.07] bg-[#0c1426]/70 p-4 transition-colors hover:border-[#22C1FF]/25 hover:bg-[#0c1426]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#F8FAFC]">{metric.label}</p>
          <p className="mt-1 text-xs text-[#64748B]">{metric.explanation}</p>
        </div>
        <Badge className={healthStatusBadgeClass(metric.status)}>
          {healthStatusLabel(metric.status)}
        </Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span>Score</span>
          <span className="tabular-nums text-[#CBD5E1]">
            {metric.scorePercent != null ? `${metric.scorePercent}%` : "—"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
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

function ModuleCard({ tile }: { tile: WorkforceModuleTile }) {
  return (
    <DashboardCard className="flex h-full flex-col p-5 transition-colors hover:border-[#22C1FF]/20" elevated>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-[#F8FAFC]">{tile.name}</h3>
        <Badge className={tileBadgeClass(tile.statusBadge.variant)}>{tile.statusBadge.label}</Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{tile.valueProposition}</p>
      <p className="mt-4 text-sm font-medium text-[#CBD5E1]">{tile.keyMetric}</p>
      <div className="mt-auto pt-5">
        <Link
          href={tile.href}
          className="inline-flex items-center rounded-lg border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-3 py-2 text-sm font-medium text-[#22C1FF] transition-colors hover:bg-[#22C1FF]/15"
        >
          {tile.ctaLabel} →
        </Link>
      </div>
    </DashboardCard>
  );
}

function AttentionItem({ item }: { item: WorkforceAttentionQueueItem }) {
  return (
    <li>
      <DashboardCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={severityBadgeClass(item.severity)}>{item.severity}</Badge>
            <p className="font-medium text-[#F8FAFC]">{item.title}</p>
          </div>
          <p className="text-sm text-[#94A3B8]">{item.explanation}</p>
        </div>
        <Link
          href={item.href}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-[#22C1FF] hover:bg-white/5"
        >
          {item.recommendedAction}
        </Link>
      </DashboardCard>
    </li>
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

  const { kpis, healthRadar, attentionQueue, moduleTiles, procedureForecast, financialIntelligence, planning, canManage } =
    data;

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
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-[#22C1FF]/20 bg-gradient-to-br from-[#0c1426] via-[#0f1a30] to-[#0a1020] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#22C1FF]/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/90">
              WorkforceOS · Command Centre
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">
              Workforce Command Centre
            </h1>
            <p className="text-sm leading-relaxed text-[#94A3B8] sm:text-base">
              Clinical workforce readiness, staffing, cost, recruitment, and compliance intelligence.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`${base}/planning`}
                className="rounded-lg border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-4 py-2.5 text-sm font-semibold text-[#22C1FF] hover:bg-[#22C1FF]/20"
              >
                Open Workforce Planning
              </Link>
              <Link
                href={`${base}/procedure-staffing`}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-[#CBD5E1] hover:bg-white/5"
              >
                Procedure Staffing
              </Link>
              <Link
                href={`${base}/payroll`}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-[#CBD5E1] hover:bg-white/5"
              >
                Payroll & Wages
              </Link>
              <Link
                href={`${base}/hr-reconciliation`}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-[#CBD5E1] hover:bg-white/5"
              >
                HR Reconciliation
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <section aria-label="Executive KPIs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Staff" value={kpis.totalStaff} />
        <StatCard label="Clinically Eligible" value={kpis.clinicallyEligible} />
        <StatCard label="Credential Risks" value={kpis.credentialRisks} />
        <StatCard label="Open Recruitment" value={kpis.openRecruitment} />
        <StatCard label="Procedure Gaps" value={kpis.upcomingProcedureGaps} />
        <StatCard
          label="Weekly Wage Exposure"
          value={formatCentsAsCurrency(kpis.weeklyWageExposureCents)}
        />
      </section>

      <section aria-label="Workforce health radar">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Workforce Health Radar</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Operational readiness across compliance, staffing, recruitment, and payroll.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {healthRadar.map((metric) => (
            <HealthBar key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <section aria-label="Needs attention" className="xl:col-span-3">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Needs Attention</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Highest-priority workforce issues ranked by severity and planning signals.
          </p>
          {attentionQueue.length === 0 ? (
            <DashboardCard className="mt-4 p-8 text-center">
              <p className="text-sm text-[#94A3B8]">
                No urgent workforce issues detected. Monitor planning signals for changes.
              </p>
            </DashboardCard>
          ) : (
            <ul className="mt-4 space-y-2">
              {attentionQueue.map((item) => (
                <AttentionItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>

        <section aria-label="FI Workforce Intelligence" className="xl:col-span-2">
          <DashboardCard className="h-full p-5" elevated>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">FI Workforce Intelligence</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Ranked recommendations from the workforce planning engine.
            </p>
            {planning && planning.nextBestActions.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {planning.nextBestActions.slice(0, 5).map((action, idx) => (
                  <li key={action.id} className="rounded-lg border border-white/[0.06] bg-[#0B1220]/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#64748B]">#{idx + 1}</span>
                      <Badge className={severityBadgeClass(action.priority)}>{action.priority}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#F8FAFC]">{action.title}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">{action.description}</p>
                    {action.href ? (
                      <Link href={action.href} className="mt-2 inline-block text-xs font-medium text-[#22C1FF] hover:underline">
                        Take action →
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-lg border border-white/[0.06] bg-[#0B1220]/40 px-4 py-3 text-sm text-[#94A3B8]">
                {buildEmptyPlanningFallbackMessage()}
              </p>
            )}
            {canManage ? (
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={pending}
                onClick={onRefreshPlanning}
              >
                {pending ? "Refreshing…" : "Refresh Planning Signals"}
              </Button>
            ) : null}
            {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
            {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
          </DashboardCard>
        </section>
      </div>

      <section aria-label="Intelligence modules">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Workforce Intelligence Modules</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Deep-dive modules for recruitment, payroll, staffing, compliance, and directory management.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {moduleTiles.map((tile) => (
            <ModuleCard key={tile.id} tile={tile} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Procedure staffing forecast">
          <DashboardCard className="p-5" elevated>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Procedure Staffing Forecast</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {procedureForecast.available
                ? `Horizon ${procedureForecast.horizonStart} → ${procedureForecast.horizonEnd}`
                : "Planning horizon unavailable"}
            </p>
            {procedureForecast.available ? (
              <>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#64748B]">Scheduled</dt>
                    <dd className="mt-1 text-2xl font-semibold text-[#F8FAFC]">
                      {procedureForecast.scheduledProcedures}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#64748B]">Fully staffed</dt>
                    <dd className="mt-1 text-2xl font-semibold text-emerald-300">
                      {procedureForecast.fullyStaffedProcedures}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#64748B]">Understaffed</dt>
                    <dd className="mt-1 text-2xl font-semibold text-amber-200">
                      {procedureForecast.understaffedProcedures}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#64748B]">Credential warnings</dt>
                    <dd className="mt-1 text-2xl font-semibold text-rose-300">
                      {procedureForecast.credentialWarnings}
                    </dd>
                  </div>
                </dl>
                {procedureForecast.missingRoles.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Missing roles
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {procedureForecast.missingRoles.map((r) => (
                        <li
                          key={r.role}
                          className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100"
                        >
                          {r.role} · {r.gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-4 text-sm text-[#94A3B8]">{buildEmptyPlanningFallbackMessage()}</p>
            )}
            <Link
              href={`${base}/procedure-staffing`}
              className="mt-4 inline-block text-sm font-medium text-[#22C1FF] hover:underline"
            >
              Open procedure staffing →
            </Link>
          </DashboardCard>
        </section>

        <section aria-label="Financial intelligence">
          <DashboardCard className="p-5" elevated>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Workforce Financial Intelligence</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Commercial labour cost visibility across roster, procedures, and weekly exposure.
            </p>
            {financialIntelligence.available ? (
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#64748B]">Weekly exposure</dt>
                  <dd className="mt-1 text-xl font-semibold text-[#22C1FF]">
                    {formatCentsAsCurrency(financialIntelligence.weeklyWageExposureCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#64748B]">Daily roster cost</dt>
                  <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
                    {formatCentsAsCurrency(financialIntelligence.dailyRosterCostCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#64748B]">Procedure labour</dt>
                  <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
                    {formatCentsAsCurrency(financialIntelligence.procedureLabourCostCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-[#64748B]">Avg / procedure</dt>
                  <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
                    {financialIntelligence.averageCostPerProcedureCents != null
                      ? formatCentsAsCurrency(financialIntelligence.averageCostPerProcedureCents)
                      : "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[#64748B]">Missing wage profiles</dt>
                  <dd className="mt-1 text-lg font-semibold text-amber-200">
                    {financialIntelligence.missingWageProfileCount}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-[#94A3B8]">
                Financial intelligence unavailable — configure wage profiles and roster shifts.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`${base}/payroll`} className="text-sm font-medium text-[#22C1FF] hover:underline">
                Payroll & wages →
              </Link>
              <Link href={`${base}/shift-cost`} className="text-sm font-medium text-[#22C1FF] hover:underline">
                Shift cost intelligence →
              </Link>
            </div>
          </DashboardCard>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-sm text-[#64748B]">
        <p>
          Workforce members lifecycle view available at{" "}
          <Link href={`${base}/directory`} className="text-[#22C1FF] hover:underline">
            workforce directory
          </Link>
          .
        </p>
        <Link href={`/fi-admin/${tenantId}/staff`} className="text-[#22C1FF] hover:underline">
          FI staff directory →
        </Link>
      </footer>
    </div>
  );
}