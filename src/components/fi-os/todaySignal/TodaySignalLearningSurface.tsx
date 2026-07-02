"use client";

import { Activity, Clock3, Layers, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, InfoNotice, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import type { TodaySignalLearningPageModel } from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary";

function healthLabel(health: "quiet" | "normal" | "watch" | "attention"): string {
  switch (health) {
    case "quiet":
      return "Quiet";
    case "watch":
      return "Watch";
    case "attention":
      return "Needs attention";
    default:
      return "Normal";
  }
}

function healthBadgeClass(health: "quiet" | "normal" | "watch" | "attention"): string {
  switch (health) {
    case "quiet":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    case "watch":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "attention":
      return "border-orange-500/30 bg-orange-500/10 text-orange-100";
    default:
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  }
}

function cardToneClass(tone: "neutral" | "watch" | "attention"): string {
  switch (tone) {
    case "watch":
      return "border-amber-500/20";
    case "attention":
      return "border-orange-500/25";
    default:
      return "border-white/[0.08]";
  }
}

function cardIcon(id: string) {
  switch (id) {
    case "recurring-types":
      return <Layers className="h-4 w-4" aria-hidden />;
    case "avg-resolution":
      return <Clock3 className="h-4 w-4" aria-hidden />;
    case "critical-open":
      return <Activity className="h-4 w-4" aria-hidden />;
    case "role-resolution":
      return <Users className="h-4 w-4" aria-hidden />;
    default:
      return <Activity className="h-4 w-4" aria-hidden />;
  }
}

function EmptyList({ message }: { message: string }) {
  return <p className="text-sm text-slate-400">{message}</p>;
}

export function TodaySignalLearningSurface({ model }: { model: TodaySignalLearningPageModel }) {
  if (model.status === "disabled") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Signal Learning</h1>
          <p className="text-sm text-slate-400">What Today is learning from operational signals.</p>
        </header>
        <InfoNotice variant="info" title="Learning not enabled">
          <p className="text-sm">Signal learning is not enabled for this tenant.</p>
        </InfoNotice>
      </div>
    );
  }

  if (model.status === "empty") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Signal Learning</h1>
          <p className="text-sm text-slate-400">What Today is learning from operational signals.</p>
          <p className="text-xs text-slate-500">
            Operational patterns only. No patient-identifying data is shown.
          </p>
        </header>
        <InfoNotice variant="info" title="Collecting observations">
          <p className="text-sm">
            Signal learning is enabled, but FI has not collected enough observations yet.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Observations accumulate as staff use Today over the last {model.rangeDays} days.
          </p>
        </InfoNotice>
      </div>
    );
  }

  const { view } = model;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Signal Learning</h1>
            <p className="text-sm text-slate-400">What Today is learning from operational signals.</p>
            <p className="text-xs text-slate-500">
              Operational patterns only. No patient-identifying data is shown.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              healthBadgeClass(view.health)
            )}
          >
            {healthLabel(view.health)} · last {view.rangeDays} days
          </span>
        </div>
      </header>

      {view.warnings.length > 0 ? (
        <InfoNotice variant="warning" title="Operational patterns">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {view.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InfoNotice>
      ) : null}

      <section className="space-y-4">
        <SectionHeader title="Health overview" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {view.cards.map((card) => (
            <div key={card.id} className={cn("rounded-xl border", cardToneClass(card.tone))}>
              <StatCard label={card.label} value={card.value} icon={cardIcon(card.id)} />
              <p className="px-4 pb-3 text-xs leading-relaxed text-slate-500">{card.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Recurring signals" />
          <div className="mt-4 space-y-3">
            {view.recurringSignals.length === 0 ? (
              <EmptyList message="No recurring signal types in this window." />
            ) : (
              view.recurringSignals.map((row) => (
                <div
                  key={`${row.signalType}-${row.count}`}
                  className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{row.signalType}</p>
                    <p className="text-xs text-slate-500">{row.helper}</p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-slate-300">
                    {row.count} occurrence{row.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Slowest resolved signals" />
          <div className="mt-4 space-y-3">
            {view.slowestSignals.length === 0 ? (
              <EmptyList message="No resolved signals in this window yet." />
            ) : (
              view.slowestSignals.map((row) => (
                <div
                  key={`${row.signalType}-${row.averageResolutionLabel}`}
                  className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{row.signalType}</p>
                    <p className="text-xs text-slate-500">
                      {row.sampleSize} resolved sample{row.sampleSize === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-slate-300">{row.averageResolutionLabel}</p>
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Critical signals still open" />
          <div className="mt-4 space-y-3">
            {view.unresolvedCriticalSignals.length === 0 ? (
              <EmptyList message="No critical signal types are open beyond the threshold." />
            ) : (
              view.unresolvedCriticalSignals.map((row) => (
                <div
                  key={`${row.signalType}-${row.openForLabel}`}
                  className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{row.signalType}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{row.priorityBand}</p>
                  </div>
                  <p className="shrink-0 text-sm text-slate-300">Open {row.openForLabel}</p>
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Role resolution" />
          <div className="mt-4 space-y-3">
            {view.roleResolution.length === 0 ? (
              <EmptyList message="No role-attributed resolutions in this window yet." />
            ) : (
              view.roleResolution.map((row) => (
                <div
                  key={`${row.role}-${row.resolvedCount}`}
                  className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{row.role}</p>
                    <p className="text-xs text-slate-500">
                      {row.resolvedCount} resolved signal{row.resolvedCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-slate-300">{row.averageResolutionLabel}</p>
                </div>
              ))
            )}
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
