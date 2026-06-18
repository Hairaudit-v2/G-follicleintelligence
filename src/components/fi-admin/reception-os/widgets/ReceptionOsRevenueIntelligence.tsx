"use client";

import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ReceptionOsCommunicationActionBar } from "@/src/components/fi-admin/reception-os/ReceptionOsCommunicationActionBar";
import { buildContextFromRevenueAlert } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";
import type { ReceptionOsConversionScoreboard } from "@/src/lib/receptionOs/receptionOsRevenueModel";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function ReceptionOsConversionScoreboardWidget({
  scoreboard,
  readOnly = false,
}: {
  scoreboard: ReceptionOsConversionScoreboard;
  readOnly?: boolean;
}) {
  return (
    <DashboardCard className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Daily conversion scoreboard"
          description={readOnly ? "Read-only pipeline snapshot" : "Today's commercial activity"}
        />
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ScoreStat label="Consults completed" value={scoreboard.consultsCompletedToday} />
        <ScoreStat label="Quotes sent" value={scoreboard.quotesSentToday} />
        <ScoreStat label="Deposits collected" value={scoreboard.depositsCollectedToday} />
        <ScoreStat label="Surgery bookings" value={scoreboard.surgeryBookingsCreatedToday} />
        <ScoreStat
          label="Projected weighted revenue"
          value={formatMoney(scoreboard.projectedWeightedRevenue, scoreboard.currency)}
          highlight
        />
        <ScoreStat
          label="At-risk revenue"
          value={formatMoney(scoreboard.atRiskRevenue, scoreboard.currency)}
          warn={scoreboard.atRiskRevenue > 0}
        />
      </div>
    </DashboardCard>
  );
}

function ScoreStat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${
          warn ? "text-amber-300" : highlight ? "text-emerald-300" : "text-slate-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ReceptionOsRevenueSummaryStrip({
  summary,
  readOnly = false,
}: {
  summary: import("@/src/lib/receptionOs/receptionOsRevenueModel").ReceptionOsRevenueSummary;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-slate-400">
      <span className="font-medium text-slate-200">{readOnly ? "Revenue snapshot" : "Revenue intelligence"}</span>
      <span className="text-slate-600"> · </span>
      {summary.scoredSubjectCount} active lead{summary.scoredSubjectCount === 1 ? "" : "s"}
      <span className="text-slate-600"> · </span>
      avg {summary.averageProbabilityPercent}% conversion probability
      <span className="text-slate-600"> · </span>
      weighted {summary.currency} {summary.totalWeightedRevenue.toLocaleString()}
      {summary.totalAtRiskRevenue > 0 ? (
        <>
          <span className="text-slate-600"> · </span>
          <span className="text-amber-300">{summary.currency} {summary.totalAtRiskRevenue.toLocaleString()} at risk</span>
        </>
      ) : null}
    </div>
  );
}

export function ReceptionOsRevenueIntelligenceWidget({
  tenantId,
  tenantName,
  summary,
  revenueRiskAlerts,
  readOnly = false,
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  summary: import("@/src/lib/receptionOs/receptionOsRevenueModel").ReceptionOsRevenueSummary;
  revenueRiskAlerts: import("@/src/lib/receptionOs/receptionOsRevenueModel").ReceptionOsRevenueRiskAlert[];
  readOnly?: boolean;
  onMutated?: () => void;
}) {
  return (
    <DashboardCard className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Revenue intelligence"
          description={
            readOnly
              ? "Consultant read-only conversion outlook"
              : "Probability scoring, risk flags, and recommended actions"
          }
        />
      </div>
      <div className="space-y-4 px-4 py-4">
        <ReceptionOsRevenueSummaryStrip summary={summary} readOnly={readOnly} />

        {!readOnly && revenueRiskAlerts.length > 0 ? (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-400/90">Lost revenue alerts</p>
            <ul className="space-y-2">
              {revenueRiskAlerts.slice(0, 6).map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{alert.title}</p>
                      <p className="mt-0.5 text-slate-500">{alert.detail}</p>
                      <p className="mt-1 text-xs text-cyan-300/90">{alert.recommendedAction}</p>
                    </div>
                    {alert.href ? (
                      <Link href={alert.href} className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                        Open record
                      </Link>
                    ) : null}
                  </div>
                  <ReceptionOsCommunicationActionBar
                    tenantId={tenantId}
                    clinicName={tenantName}
                    context={buildContextFromRevenueAlert(alert, null, tenantName)}
                    showPaymentLink={
                      alert.kind === "deposit_overdue" || alert.kind === "missing_finance_payment_link"
                    }
                    onMutated={onMutated}
                    className="mt-2"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {readOnly ? "Top opportunities (read-only)" : "Top conversion opportunities"}
          </p>
          <ul className="space-y-2">
            {summary.topOpportunities.slice(0, readOnly ? 3 : 5).map((score) => (
              <li
                key={score.subjectId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{score.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{score.recommendedNextAction}</p>
                  {score.riskFlags.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-400/90">{score.riskFlags.join(" · ")}</p>
                  ) : null}
                </div>
                <div className="text-right text-sm tabular-nums">
                  <p className="font-semibold text-emerald-300">{score.probabilityPercent}%</p>
                  <p className="text-xs text-slate-500">
                    {score.currency} {score.weightedRevenue.toLocaleString()} · {score.confidenceLevel}
                  </p>
                </div>
              </li>
            ))}
            {summary.topOpportunities.length === 0 ? (
              <li className="text-sm text-slate-500">No scored opportunities in the current pipeline window.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </DashboardCard>
  );
}
