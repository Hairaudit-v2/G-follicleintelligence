"use client";

import { Download, FileBarChart } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { ReceptionPilotReviewReport } from "@/src/lib/receptionOs/receptionPilotReviewModel";

type ReceptionOsPilotReviewPanelProps = {
  tenantId: string;
  report: ReceptionPilotReviewReport;
};

export function ReceptionOsPilotReviewPanel({ tenantId, report }: ReceptionOsPilotReviewPanelProps) {
  const exportBase = `/api/tenants/${tenantId}/reception-os/export`;

  return (
    <DashboardCard className="overflow-hidden border-cyan-500/20">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Pilot review report"
          description={`${report.periodDays}-day pilot summary for owner review and commercial readiness`}
        />
        <div className="flex flex-wrap gap-2">
          <ExportLink href={`${exportBase}?format=json`} label="Export JSON" />
          <ExportLink href={`${exportBase}?format=csv`} label="Export CSV" />
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
        <MetricsList
          title="Usage & workflow"
          items={[
            { label: "Active users", value: String(report.activeUsers) },
            { label: "Tasks created", value: String(report.tasksCreated) },
            { label: "Tasks resolved", value: String(report.tasksResolved) },
            { label: "Risks closed", value: String(report.risksClosed) },
            {
              label: "Revenue at risk identified",
              value: formatMoney(report.revenueAtRiskIdentified, report.currency),
            },
            { label: "Deposits chased", value: String(report.depositsChased) },
          ]}
        />
        <MetricsList
          title="Communications & closeout"
          items={[
            { label: "Comms drafted", value: String(report.communicationsDrafted) },
            { label: "Comms sent", value: String(report.communicationsSent) },
            { label: "Comms dry-run", value: String(report.communicationsDryRun) },
            { label: "Closeouts completed", value: String(report.closeoutsCompleted) },
            {
              label: "Avg response time",
              value:
                report.averageResponseTimeMinutes != null
                  ? `${report.averageResponseTimeMinutes} min`
                  : "—",
            },
          ]}
        />
      </div>

      <div className="grid gap-4 border-t border-white/[0.06] px-4 py-4 lg:grid-cols-2">
        <MetricsList
          title="Top workflow issues"
          icon={FileBarChart}
          items={
            report.topWorkflowIssues.length > 0
              ? report.topWorkflowIssues.map((issue) => ({ label: issue.label, value: String(issue.count) }))
              : [{ label: "No workflow friction reported", value: "—" }]
          }
        />
        <MetricsList
          title="Most valuable widgets"
          icon={FileBarChart}
          items={
            report.mostValuableWidgets.length > 0
              ? report.mostValuableWidgets.map((w) => ({
                  label: w.widgetKey.replace(/_/g, " "),
                  value: String(w.viewCount),
                }))
              : [{ label: "No widget usage yet", value: "—" }]
          }
        />
      </div>
    </DashboardCard>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className={cn(
        fiOsChromeClasses.toolbarControlSurface,
        "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-cyan-100/95",
      )}
      download
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {label}
    </a>
  );
}

function MetricsList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
  icon?: typeof FileBarChart;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-cyan-400/70" aria-hidden /> : null}
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      </div>
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

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
