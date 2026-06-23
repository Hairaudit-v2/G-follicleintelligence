import Link from "next/link";
import { AlertCircle, ArrowRight, HeartPulse, LineChart, TrendingUp } from "lucide-react";

import { DashboardCard, SectionHeader, StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { AnalyticsOsSystemDiagnostics } from "@/src/components/fi-admin/analytics/AnalyticsOsSystemDiagnostics";
import type { AnalyticsExecutiveDashboardPayload } from "@/src/lib/analytics-os/analyticsExecutiveTypes";
import {
  EXECUTIVE_HEALTH_CARDS,
  analyticsOsLinkButtonClass,
  buildClinicAttentionItems,
  buildClinicModuleHealthRows,
  buildOperationalMetricGroups,
  formatExecutiveScoreValue,
  shouldShowLimitedTrendMessage,
} from "@/src/lib/analytics-os/analyticsOsClinicPresentation";
import type { AnalyticsOsDashboardPayload } from "@/src/lib/fiAdmin/analyticsOsDashboardTypes";

const ICON = 20;

function healthBandClass(band: string): string {
  if (band === "excellent" || band === "strong") return "text-emerald-300 ring-emerald-500/30";
  if (band === "watch") return "text-amber-200 ring-amber-400/35";
  return "text-orange-300 ring-orange-500/35";
}

function moduleStatusClass(label: "Ready" | "Limited data" | "Needs attention"): string {
  if (label === "Ready") return "text-emerald-300 ring-emerald-500/30";
  if (label === "Needs attention") return "text-amber-200 ring-amber-400/35";
  return "text-slate-400 ring-white/10";
}

export function AnalyticsOsDashboard({
  model,
  executive,
  showDiagnosticsExpanded = false,
}: {
  model: AnalyticsOsDashboardPayload;
  executive: AnalyticsExecutiveDashboardPayload;
  showDiagnosticsExpanded?: boolean;
}) {
  const { tenantId, tenantName, showCrmNav } = model;
  const base = `/fi-admin/${tenantId}`;
  const snapshot = executive.snapshot;

  const attentionItems = buildClinicAttentionItems(model, executive, 5);
  const metricGroups = buildOperationalMetricGroups(model, executive);
  const moduleRows = buildClinicModuleHealthRows(model, executive, base);
  const limitedTrends = shouldShowLimitedTrendMessage(snapshot);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-8 pb-10 sm:space-y-10 sm:pb-14">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(34,193,255,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(124,58,237,0.07),transparent_50%)]"
          aria-hidden
        />
        <div className="relative border-l-4 border-[#22C1FF]/80 pl-5 sm:pl-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#22C1FF]/95">FI OS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">AnalyticsOS</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
            Executive intelligence across revenue, consultations, surgery, patients, workforce, and clinic performance.
          </p>
          {tenantName ? (
            <p className="mt-2 text-sm text-[#64748B]">
              Clinic: <span className="font-medium text-[#CBD5E1]">{tenantName}</span>
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={base} className={analyticsOsLinkButtonClass}>
              Open ClinicOS
            </Link>
            {showCrmNav ? (
              <Link href={`${base}/crm`} className={analyticsOsLinkButtonClass}>
                Open LeadFlow
              </Link>
            ) : (
              <span className={analyticsOsLinkButtonClass} title="Requires CRM shell access">
                Open LeadFlow
              </span>
            )}
            <Link href={showCrmNav ? `${base}/patients` : `${base}/directory`} className={analyticsOsLinkButtonClass}>
              Open PatientOS
            </Link>
            <Link href={`${base}/cases`} className={analyticsOsLinkButtonClass}>
              Open SurgeryOS
            </Link>
            <Link href={`${base}/audit`} className={analyticsOsLinkButtonClass}>
              Open AuditOS
            </Link>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Health"
          title="Executive clinic health"
          description="At-a-glance signals to support weekly owner decisions — scores strengthen as clinic activity grows."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {EXECUTIVE_HEALTH_CARDS.map(({ key, title }) => {
            const score = snapshot[key];
            const displayValue = formatExecutiveScoreValue(score);
            const isNumeric = displayValue !== "Not enough history yet";

            return (
              <div
                key={key}
                className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#F8FAFC]">{title}</p>
                  {isNumeric ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${healthBandClass(score.band)}`}
                    >
                      {score.band === "excellent" || score.band === "strong" ? "Strong" : "Review"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{displayValue}</p>
                {isNumeric ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#22C1FF]/70 to-[#7C3AED]/70"
                      style={{ width: `${Math.max(0, Math.min(100, score.score))}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
                    Activity from bookings, consultations, payments, and surgeries will populate this view over time.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Priorities"
          title="What needs attention"
          description="Top operational signals ranked for clinic owners — act here first."
          className="mb-4"
        />
        <ul className="space-y-3">
          {attentionItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F8FAFC]">{item.headline}</p>
                {item.detail ? <p className="mt-1 text-xs text-[#94A3B8]">{item.detail}</p> : null}
              </div>
              {item.href && !item.linkDisabled ? (
                <Link
                  href={item.href}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#22C1FF] hover:underline"
                >
                  Review
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Operations"
          title="Key operational metrics"
          description="Essential KPIs grouped by business area — expanded detail lives in each FI OS module."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {metricGroups.map((group) => (
            <div key={group.id} className="rounded-xl border border-white/[0.08] bg-[#0c1220]/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">{group.title}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.metrics.slice(0, 2).map((metric) => (
                  <StatCard key={`${group.id}_${metric.label}`} label={metric.label} value={metric.value} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Trends"
          title="Executive trends & readiness"
          description="Longitudinal intelligence for planning and forecasting."
          className="mb-4"
        />
        {limitedTrends ? (
          <div className="flex gap-3 rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-[#22C1FF]" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Trend intelligence will strengthen as more bookings, consultations, payments, surgeries, and audit outcomes
              are captured.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {snapshot.metrics
              .filter((m) => !["total_events", "active_modules"].includes(m.key))
              .slice(0, 6)
              .map((metric) => (
                <StatCard
                  key={metric.key}
                  label={metric.label}
                  value={
                    metric.changePercent != null
                      ? `${metric.value} (${metric.changePercent >= 0 ? "+" : ""}${metric.changePercent}%)`
                      : String(metric.value)
                  }
                  icon={<LineChart size={ICON} strokeWidth={1.75} />}
                />
              ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <SectionHeader
          kicker="Modules"
          title="Module health"
          description="Readiness of each FI OS area that feeds clinic intelligence."
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {moduleRows.map((row) => (
            <div
              key={row.id}
              className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-[#F8FAFC]">{row.label}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${moduleStatusClass(row.statusLabel)}`}
                >
                  {row.statusLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#94A3B8]">{row.summary}</p>
              {row.linkDisabled ? (
                <span className="mt-3 text-xs font-medium text-[#64748B]">Link unavailable for this user</span>
              ) : (
                <Link href={row.href} className="mt-3 text-sm font-medium text-[#22C1FF] hover:underline">
                  Open module →
                </Link>
              )}
            </div>
          ))}
        </div>
      </DashboardCard>

      <AnalyticsOsSystemDiagnostics
        model={model}
        executive={executive}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />

      {model.loadNotes.length > 0 && !showDiagnosticsExpanded ? (
        <DashboardCard className="border-white/[0.06] bg-[#0c1220]/40 p-4 sm:p-5">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#64748B]" aria-hidden />
            <div>
              <p className="text-sm text-[#94A3B8]">
                Some module snapshots loaded partially. Expand <span className="text-[#CBD5E1]">System diagnostics</span>{" "}
                for operator details.
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-[#64748B]">
                <HeartPulse className="h-3.5 w-3.5" aria-hidden />
                Clinic workflows are unaffected.
              </p>
            </div>
          </div>
        </DashboardCard>
      ) : null}
    </div>
  );
}
