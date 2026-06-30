"use client";

import { BarChart3, Gauge, Target, Users } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { cn } from "@/lib/utils";
import type {
  ReceptionPilotManagerScores,
  ReceptionPilotMetricsSummary,
} from "@/src/lib/receptionOs/receptionPilotMetricsModel";

type ReceptionOsPilotManagerWidgetProps = {
  summary: ReceptionPilotMetricsSummary;
  scores: ReceptionPilotManagerScores;
};

export function ReceptionOsPilotManagerWidget({
  summary,
  scores,
}: ReceptionOsPilotManagerWidgetProps) {
  return (
    <DashboardCard className="overflow-hidden border-violet-500/20">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Pilot manager"
          description="Evolved Hair pilot adoption and workflow metrics (today)"
        />
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreTile icon={Users} label="Adoption score" value={scores.adoptionScore} />
        <ScoreTile
          icon={Gauge}
          label="Workflow completion"
          value={scores.workflowCompletionScore}
        />
        <ScoreTile icon={Target} label="Risk closure" value={scores.riskClosureScore} />
        <ScoreTile icon={BarChart3} label="Feedback count" value={scores.feedbackCount} isCount />
      </div>

      <div className="grid gap-4 border-t border-white/[0.06] px-4 py-4 lg:grid-cols-2">
        <MetricsList
          title="Operational summary"
          items={[
            { label: "Daily active users", value: String(summary.dailyActiveUsers) },
            { label: "Tasks created", value: String(summary.tasksCreated) },
            { label: "Tasks resolved", value: String(summary.tasksResolved) },
            {
              label: "Avg resolution time",
              value:
                summary.averageTaskResolutionMinutes != null
                  ? `${summary.averageTaskResolutionMinutes} min`
                  : "—",
            },
            { label: "Unresolved critical risks", value: String(summary.unresolvedCriticalRisks) },
            {
              label: "Comms drafted / sent / dry-run",
              value: `${summary.communicationsDrafted} / ${summary.communicationsSent} / ${summary.communicationsDryRun}`,
            },
            { label: "Closeouts completed", value: String(summary.closeoutsCompleted) },
          ]}
        />

        <div className="space-y-4">
          <MetricsList
            title="Most-used widgets"
            items={
              summary.mostUsedWidgets.length > 0
                ? summary.mostUsedWidgets.map((w) => ({
                    label: w.widgetKey.replace(/_/g, " "),
                    value: String(w.viewCount),
                  }))
                : [{ label: "No widget views yet", value: "—" }]
            }
          />
          <MetricsList
            title="Top friction points"
            items={
              scores.topFrictionPoints.length > 0
                ? scores.topFrictionPoints.map((f) => ({ label: f.label, value: String(f.count) }))
                : [{ label: "No friction feedback yet", value: "—" }]
            }
          />
        </div>
      </div>
    </DashboardCard>
  );
}

function ScoreTile({
  icon: Icon,
  label,
  value,
  isCount = false,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  isCount?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-400/80" aria-hidden />
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums text-slate-50",
          isCount ? "text-2xl" : "text-2xl"
        )}
      >
        {isCount ? value : `${value}%`}
      </p>
    </div>
  );
}

function MetricsList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="capitalize text-slate-400">{item.label}</span>
            <span className="font-medium tabular-nums text-slate-200">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
