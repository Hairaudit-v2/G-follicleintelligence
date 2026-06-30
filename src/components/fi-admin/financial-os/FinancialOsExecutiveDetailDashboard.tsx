"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { FinancialOsExecutiveFilters } from "@/src/components/fi-admin/financial-os/FinancialOsExecutiveFilters";
import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExecutiveFinanceDetailPayload } from "@/src/lib/financialOs/financialExecutiveIntelligence.server";

function fmtMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sourceLabel(source: string): string {
  return source.replace(/_/g, " ");
}

export function FinancialOsExecutiveDetailDashboard(props: {
  data: ExecutiveFinanceDetailPayload;
  filterOptions: {
    clinicOptions: Array<{ value: string; label: string }>;
    procedureTypes: string[];
    sources: string[];
    consultantOptions: Array<{ value: string; label: string }>;
  };
}) {
  const { data, filterOptions } = props;
  const { snapshot, comparison, attribution } = data;
  const base = `/fi-admin/${data.tenantId}/financial-os`;
  const forecastMeta = snapshot.source_metadata;
  const explanation = Array.isArray(forecastMeta.forecast_explanation)
    ? (forecastMeta.forecast_explanation as Array<{
        factor: string;
        contribution_cents: number;
        weight: number;
      }>)
    : [];

  return (
    <div className={financialOsClasses.pageShell}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">
            FinancialOS
          </p>
          <h1 className="text-xl font-semibold text-slate-50 sm:text-2xl">
            Executive finance intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Owner-level revenue, profitability, attribution, AR risk, and forecast —{" "}
            {data.periodStart} to {data.periodEnd}
          </p>
        </div>
        <Link
          href={base}
          className={cn(
            fiOsChromeClasses.toolbarControlSurface,
            "px-3 py-1.5 text-xs font-semibold text-slate-200"
          )}
        >
          ← Command centre
        </Link>
      </header>

      <FinancialOsExecutiveFilters
        tenantId={data.tenantId}
        filters={data.filters}
        clinicOptions={filterOptions.clinicOptions}
        procedureTypes={filterOptions.procedureTypes}
        sources={filterOptions.sources}
        consultantOptions={filterOptions.consultantOptions}
      />

      {data.insights.length > 0 ? (
        <FinancialOsSectionCard title="Alert insights" kicker="Deterministic">
          <ul className="space-y-2">
            {data.insights.map((insight) => (
              <li key={insight.kind} className={financialOsClasses.subPanel}>
                <p className="text-xs font-semibold text-slate-200">{insight.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{insight.detail}</p>
              </li>
            ))}
          </ul>
        </FinancialOsSectionCard>
      ) : null}

      <FinancialOsSectionCard title="Revenue performance" kicker="Ledger + invoices">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Gross revenue"
            value={fmtMoney(snapshot.gross_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Collected revenue"
            value={fmtMoney(snapshot.collected_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Surgery revenue"
            value={fmtMoney(snapshot.surgery_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Treatment revenue"
            value={fmtMoney(snapshot.treatment_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Paid invoices"
            value={String(snapshot.total_paid_invoices)}
          />
          <FinancialOsMetricTile label="Consults" value={String(snapshot.total_consults)} />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard title="Surgery profitability" kicker="Cost models">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Gross profit"
            value={fmtMoney(snapshot.gross_profit_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Average margin"
            value={`${snapshot.average_margin_percentage.toFixed(1)}%`}
          />
          <FinancialOsMetricTile
            label="Revenue per case"
            value={fmtMoney(snapshot.average_revenue_per_case_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Revenue per graft"
            value={
              snapshot.average_revenue_per_graft_cents != null
                ? fmtMoney(snapshot.average_revenue_per_graft_cents, data.currency)
                : "—"
            }
          />
          <FinancialOsMetricTile label="Total surgeries" value={String(snapshot.total_surgeries)} />
          <FinancialOsMetricTile
            label="Highest margin procedure"
            value={snapshot.highest_margin_procedure_type?.toUpperCase() ?? "—"}
          />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard title="Revenue attribution" kicker="LeadFlow → ledger">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Best revenue source"
            value={snapshot.best_revenue_source ? sourceLabel(snapshot.best_revenue_source) : "—"}
          />
          <FinancialOsMetricTile
            label="Best profit source"
            value={snapshot.best_profit_source ? sourceLabel(snapshot.best_profit_source) : "—"}
          />
          <FinancialOsMetricTile
            label="Unknown attribution"
            value={`${Number(forecastMeta.unknown_attribution_percentage ?? attribution.unknown_attribution_percentage).toFixed(1)}%`}
          />
        </dl>
        <div className="mt-4">
          <FinancialOsTable
            isEmpty={attribution.revenue_by_source.length === 0}
            emptyMessage="No attributed revenue in this period."
            head={
              <>
                <FinancialOsTh>Source</FinancialOsTh>
                <FinancialOsTh>Collected</FinancialOsTh>
                <FinancialOsTh>Gross profit</FinancialOsTh>
              </>
            }
          >
            {attribution.revenue_by_source.map((row) => {
              const profit =
                attribution.profit_by_source.find((p) => p.source === row.source)?.cents ?? 0;
              return (
                <tr key={row.source} className={financialOsClasses.tableRow}>
                  <td className={financialOsClasses.tableCellStrong}>{sourceLabel(row.source)}</td>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtMoney(row.cents, data.currency)}
                  </td>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtMoney(profit, data.currency)}
                  </td>
                </tr>
              );
            })}
          </FinancialOsTable>
        </div>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard title="Accounts receivable risk" kicker="Collections">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Outstanding revenue"
            value={fmtMoney(snapshot.outstanding_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Overdue revenue"
            value={fmtMoney(snapshot.overdue_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Overdue invoices"
            value={String(snapshot.total_overdue_invoices)}
          />
          <FinancialOsMetricTile
            label="AR risk score"
            value={`${snapshot.ar_risk_score.toFixed(1)} / 100`}
          />
        </dl>
      </FinancialOsSectionCard>

      <FinancialOsSectionCard title="Forecast" kicker="Deterministic v1">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Forecast revenue"
            value={fmtMoney(snapshot.forecast_revenue_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Confidence"
            value={`${snapshot.forecast_confidence.toFixed(0)}%`}
          />
          <FinancialOsMetricTile
            label="Historical collection rate"
            value={`${Number(forecastMeta.historical_collection_rate_pct ?? 0).toFixed(1)}%`}
          />
        </dl>
        {explanation.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Explanation factors
            </p>
            <FinancialOsTable
              isEmpty={false}
              head={
                <>
                  <FinancialOsTh>Factor</FinancialOsTh>
                  <FinancialOsTh>Contribution</FinancialOsTh>
                  <FinancialOsTh>Weight</FinancialOsTh>
                </>
              }
            >
              {explanation.map((f) => (
                <tr key={f.factor} className={financialOsClasses.tableRow}>
                  <td className={financialOsClasses.tableCell}>{f.factor.replace(/_/g, " ")}</td>
                  <td className={financialOsClasses.tableCellMono}>
                    {fmtMoney(f.contribution_cents, data.currency)}
                  </td>
                  <td className={financialOsClasses.tableCellMono}>{f.weight.toFixed(2)}</td>
                </tr>
              ))}
            </FinancialOsTable>
          </div>
        ) : null}
      </FinancialOsSectionCard>

      <FinancialOsSectionCard title="Period comparison" kicker="vs previous">
        <dl className={financialOsClasses.metricGrid}>
          <FinancialOsMetricTile
            label="Collected delta"
            value={fmtMoney(comparison.collected_revenue_delta_cents, data.currency)}
            foot={
              comparison.collected_revenue_delta_pct != null
                ? `${comparison.collected_revenue_delta_pct >= 0 ? "+" : ""}${comparison.collected_revenue_delta_pct.toFixed(1)}%`
                : undefined
            }
          />
          <FinancialOsMetricTile
            label="Gross profit delta"
            value={fmtMoney(comparison.gross_profit_delta_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Margin delta"
            value={`${comparison.margin_delta_percentage_points >= 0 ? "+" : ""}${comparison.margin_delta_percentage_points.toFixed(1)}pp`}
          />
          <FinancialOsMetricTile
            label="Outstanding delta"
            value={fmtMoney(comparison.outstanding_delta_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Forecast delta"
            value={fmtMoney(comparison.forecast_delta_cents, data.currency)}
          />
          <FinancialOsMetricTile
            label="Source shift"
            value={
              comparison.best_revenue_source_shift.changed
                ? `${sourceLabel(comparison.best_revenue_source_shift.previous ?? "—")} → ${sourceLabel(comparison.best_revenue_source_shift.current ?? "—")}`
                : "No change"
            }
          />
        </dl>
        {data.previousSnapshot ? (
          <p className="mt-3 text-xs text-slate-500">
            Previous period baseline: {data.previousSnapshot.period_start} →{" "}
            {data.previousSnapshot.period_end} (
            {fmtMoney(data.previousSnapshot.collected_revenue_cents, data.currency)} collected)
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">No previous period snapshot on record.</p>
        )}
      </FinancialOsSectionCard>

      {data.snapshotHistory.length > 1 ? (
        <FinancialOsSectionCard title="Snapshot history" kicker="Append-only">
          <FinancialOsTable
            isEmpty={false}
            head={
              <>
                <FinancialOsTh>Calculated</FinancialOsTh>
                <FinancialOsTh>Period</FinancialOsTh>
                <FinancialOsTh>Collected</FinancialOsTh>
                <FinancialOsTh>AR risk</FinancialOsTh>
              </>
            }
          >
            {data.snapshotHistory.slice(0, 12).map((row) => (
              <tr key={row.id} className={financialOsClasses.tableRow}>
                <td className={financialOsClasses.tableCell}>{row.calculated_at.slice(0, 10)}</td>
                <td className={financialOsClasses.tableCell}>
                  {row.period_start} → {row.period_end}
                </td>
                <td className={financialOsClasses.tableCellMono}>
                  {fmtMoney(row.collected_revenue_cents, data.currency)}
                </td>
                <td className={financialOsClasses.tableCellMono}>{row.ar_risk_score.toFixed(1)}</td>
              </tr>
            ))}
          </FinancialOsTable>
        </FinancialOsSectionCard>
      ) : null}
    </div>
  );
}
