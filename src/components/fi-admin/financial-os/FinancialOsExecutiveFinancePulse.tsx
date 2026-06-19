"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExecutiveFinancePulsePayload } from "@/src/lib/financialOs/financialExecutiveIntelligence.server";

function fmtMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sourceLabel(source: string | null): string {
  if (!source) return "—";
  return source.replace(/_/g, " ");
}

function ComparisonBadge(props: { direction: "up" | "down" | "flat"; label: string; invert?: boolean }) {
  const { direction, label, invert } = props;
  if (direction === "flat") {
    return <span className="text-[10px] text-slate-500">{label}</span>;
  }
  const isPositive = direction === "up";
  const good = invert ? !isPositive : isPositive;
  const tone = good ? "text-emerald-400/90" : "text-amber-400/90";
  const arrow = direction === "up" ? "↑" : "↓";
  return (
    <span className={cn("text-[10px] font-medium tabular-nums", tone)}>
      {arrow} {label}
    </span>
  );
}

export function FinancialOsExecutiveFinancePulse(props: { data: ExecutiveFinancePulsePayload }) {
  const { data } = props;
  const { snapshot, comparison } = data;
  const base = `/fi-admin/${data.tenantId}/financial-os`;

  const collectedDeltaPct =
    comparison.collected_revenue_delta_pct != null
      ? `${comparison.collected_revenue_delta_pct >= 0 ? "+" : ""}${comparison.collected_revenue_delta_pct.toFixed(1)}% vs prev`
      : "vs previous period";

  return (
    <FinancialOsSectionCard
      title="Executive finance pulse"
      kicker="Owner intelligence"
      description={
        <>
          Period {data.periodStart} → {data.periodEnd}. Deterministic aggregation — no AI inference.{" "}
          <Link href={`${base}/executive`} className={financialOsClasses.inlineLink}>
            Full executive view
          </Link>
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Collected revenue"
          value={fmtMoney(snapshot.collected_revenue_cents, data.currency)}
          foot={
            <ComparisonBadge direction={comparison.badges.collected_vs_previous} label={collectedDeltaPct} />
          }
        />
        <FinancialOsMetricTile
          label="Gross profit"
          value={fmtMoney(snapshot.gross_profit_cents, data.currency)}
          foot={
            <ComparisonBadge
              direction={comparison.badges.margin}
              label={`${comparison.margin_delta_percentage_points >= 0 ? "+" : ""}${comparison.margin_delta_percentage_points.toFixed(1)}pp margin`}
            />
          }
        />
        <FinancialOsMetricTile
          label="Outstanding revenue"
          value={fmtMoney(snapshot.outstanding_revenue_cents, data.currency)}
          foot={
            <ComparisonBadge
              direction={comparison.badges.outstanding}
              label={`${comparison.outstanding_delta_cents >= 0 ? "+" : ""}${fmtMoney(Math.abs(comparison.outstanding_delta_cents), data.currency)}`}
              invert
            />
          }
        />
        <FinancialOsMetricTile
          label="AR risk score"
          value={`${snapshot.ar_risk_score.toFixed(1)} / 100`}
          foot={`${comparison.ar_risk_delta >= 0 ? "+" : ""}${comparison.ar_risk_delta.toFixed(1)} vs previous`}
        />
        <FinancialOsMetricTile
          label="Forecast revenue"
          value={fmtMoney(snapshot.forecast_revenue_cents, data.currency)}
          foot={`${snapshot.forecast_confidence.toFixed(0)}% confidence · deterministic v1`}
        />
        <FinancialOsMetricTile
          label="Best revenue source"
          value={sourceLabel(snapshot.best_revenue_source)}
          foot={
            comparison.badges.source_shift ? (
              <span className="text-[10px] text-amber-400/90">
                Source shift: {sourceLabel(comparison.best_revenue_source_shift.previous)} →{" "}
                {sourceLabel(comparison.best_revenue_source_shift.current)}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">No source shift vs previous</span>
            )
          }
        />
      </dl>

      {data.insights.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Executive insights</p>
          <ul className="space-y-1.5">
            {data.insights.slice(0, 4).map((insight) => (
              <li
                key={insight.kind}
                className={cn(
                  financialOsClasses.subPanel,
                  insight.severity === "critical" && "border-rose-500/20",
                  insight.severity === "warning" && "border-amber-500/20",
                )}
              >
                <p className="text-xs font-semibold text-slate-200">{insight.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{insight.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`${base}/executive`}
          className={cn(fiOsChromeClasses.toolbarControlSurface, "px-3 py-1.5 text-xs font-semibold text-cyan-100/95")}
        >
          Executive detail
        </Link>
      </div>
    </FinancialOsSectionCard>
  );
}
