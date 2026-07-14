"use client";

import { cn } from "@/lib/utils";
import {
  DashboardCard,
  InfoNotice,
  SectionHeader,
  StatCard,
} from "@/src/components/fi-admin/dashboard-ui";
import {
  getTodaySignalValidationCheck,
  type TodaySignalValidationDomainSummary,
  type TodaySignalValidationOverallStatus,
  type TodaySignalValidationReport,
  type TodaySignalValidationStatus,
} from "@/src/lib/fiOs/todaySignal/todaySignalValidationRegistry";
import type { TodaySignalBakePageModel } from "@/src/lib/fiOs/todaySignal/todaySignalValidation.server";
import { Activity, CheckCircle2, Flag, ShieldAlert, Timer } from "lucide-react";

function overallLabel(status: TodaySignalValidationOverallStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "watch":
      return "Watch";
    case "fail":
      return "Fail";
    default:
      return "Not enough data";
  }
}

function overallBadgeClass(status: TodaySignalValidationOverallStatus): string {
  switch (status) {
    case "pass":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    case "watch":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "fail":
      return "border-rose-500/30 bg-rose-500/10 text-rose-100";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function checkStatusLabel(status: TodaySignalValidationStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "watch":
      return "Watch";
    case "fail":
      return "Fail";
    default:
      return "N/A";
  }
}

function checkStatusClass(status: TodaySignalValidationStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-300";
    case "watch":
      return "text-amber-200";
    case "fail":
      return "text-rose-300";
    default:
      return "text-slate-500";
  }
}

function domainToneClass(status: TodaySignalValidationStatus): string {
  switch (status) {
    case "watch":
      return "border-amber-500/20";
    case "fail":
      return "border-rose-500/25";
    default:
      return "border-white/[0.08]";
  }
}

function flagLabel(enabled: boolean): string {
  return enabled ? "Enabled" : "Off";
}

function flagClass(enabled: boolean): string {
  return enabled
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
    : "border-slate-500/25 bg-slate-500/10 text-slate-400";
}

function DomainCard({ domain }: { domain: TodaySignalValidationDomainSummary }) {
  return (
    <DashboardCard className={cn("p-5", domainToneClass(domain.status))} elevated>
      <div className="flex items-start justify-between gap-3">
        <SectionHeader title={domain.label} />
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            checkStatusClass(domain.status)
          )}
        >
          {checkStatusLabel(domain.status)}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {domain.checks.map((check) => (
          <li key={check.checkId} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-300">
              {check.message ??
                getTodaySignalValidationCheck(check.checkId)?.label ??
                check.checkId.replace(/\./g, " · ")}
            </span>
            <span className={cn("shrink-0 text-xs uppercase", checkStatusClass(check.status))}>
              {checkStatusLabel(check.status)}
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function TodaySignalBakeSurface({ model }: { model: TodaySignalBakePageModel }) {
  const { report } = model;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
              D6 Intelligence Bake
            </h1>
            <p className="text-sm text-slate-400">
              Validation status for the living Today and workspace signal layer.
            </p>
            <p className="text-xs text-slate-500">
              Operational safety checks only. No patient-identifying data is shown.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              overallBadgeClass(report.overallStatus)
            )}
          >
            {overallLabel(report.overallStatus)}
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today feed items"
          value={String(report.counts.todayFeedItemCount)}
          icon={<Activity className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Workspace signals"
          value={String(report.counts.workspaceSignalCount)}
          icon={<Flag className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Presence snapshots"
          value={String(report.counts.presenceSnapshotCount)}
          icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Loader time"
          value={`${Math.round(report.loaderElapsedMs)}ms`}
          icon={<Timer className="h-4 w-4" aria-hidden />}
        />
      </section>

      <DashboardCard className="p-5" elevated>
        <SectionHeader title="Rollout flags" />
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["Today surface", report.rolloutFlags.todaySurface],
              ["Revision polling", report.rolloutFlags.revisionPolling],
              ["Realtime enabled", report.rolloutFlags.realtimeEnabled],
              ["Signal learning", report.rolloutFlags.signalLearning],
              ["Workspace signal sync", report.rolloutFlags.workspaceSignalSync],
              ["Presence engine", report.rolloutFlags.presenceEngine],
            ] as const
          ).map(([label, enabled]) => (
            <span
              key={label}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                flagClass(enabled)
              )}
            >
              {label}: {flagLabel(enabled)}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Revision endpoint: {report.counts.revisionEndpointAvailable ? "available" : "unavailable"}
          {" · "}
          Learning: {report.counts.learningEnabled ? "enabled" : "disabled"}
        </p>
      </DashboardCard>

      <section className="space-y-4">
        <SectionHeader title="Validation domains" />
        <div className="grid gap-4 lg:grid-cols-2">
          {report.domains.map((domain) => (
            <DomainCard key={domain.domain} domain={domain} />
          ))}
        </div>
      </section>

      {report.warnings.length > 0 ? (
        <InfoNotice variant="warning" title="Warnings">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InfoNotice>
      ) : null}

      <DashboardCard className="p-5" elevated>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
          <div>
            <SectionHeader title="Recommended next action" />
            <p className="mt-2 text-sm text-slate-300">{report.recommendedNextAction}</p>
            <p className="mt-2 text-xs text-slate-500">
              Report generated {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

export type { TodaySignalValidationReport };
