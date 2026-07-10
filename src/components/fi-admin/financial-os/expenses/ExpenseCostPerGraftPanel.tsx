import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExpenseCpgSummary } from "@/src/lib/financialOs/expenses/expenseCostPerGraftCore";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function ExpenseCostPerGraftPanel(props: { summary: ExpenseCpgSummary }) {
  const s = props.summary;

  return (
    <FinancialOsSectionCard
      kicker="Intelligence"
      title="Cost per graft (actuals vs standard)"
      description={
        <>
          Posted clinical consumables / case-linked spend ({s.period_start} → {s.period_end}) ÷
          grafts implanted from procedure-day (or profitability snapshots). Standard uses active
          surgery cost model graft consumable rate. Full model CPG still lives in Surgery Economics.
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Clinical spend"
          value={formatMoneyFromCents(s.total_clinical_spend_cents)}
        />
        <FinancialOsMetricTile
          label="Grafts implanted"
          value={String(s.total_grafts_implanted)}
        />
        <FinancialOsMetricTile
          label="Overall actual CPG"
          value={
            s.overall_actual_cpg_cents != null
              ? formatMoneyFromCents(s.overall_actual_cpg_cents)
              : "—"
          }
        />
        <FinancialOsMetricTile
          label="Unlinked clinical spend"
          value={formatMoneyFromCents(s.unlinked_clinical_spend_cents)}
          foot="No case / procedure type"
        />
      </dl>

      <div className="mt-4">
        <FinancialOsTable
          isEmpty={s.by_procedure.length === 0}
          emptyMessage="No procedure-linked spend or grafts in this period. Link expenses to cases and record grafts on procedure day."
          head={
            <>
              <FinancialOsTh>Procedure</FinancialOsTh>
              <FinancialOsTh>Spend</FinancialOsTh>
              <FinancialOsTh>Grafts</FinancialOsTh>
              <FinancialOsTh>Actual CPG</FinancialOsTh>
              <FinancialOsTh>Standard graft unit</FinancialOsTh>
              <FinancialOsTh>Variance</FinancialOsTh>
            </>
          }
        >
          {s.by_procedure.map((row) => (
            <tr key={row.procedure_type} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>
                {row.procedure_type}
                <div className={financialOsClasses.mutedMeta}>
                  {row.case_count} case(s) · {row.expense_count} expense(s)
                </div>
              </td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(row.spend_cents)}
              </td>
              <td className={financialOsClasses.tableCell}>{row.grafts_implanted}</td>
              <td className={financialOsClasses.tableCell}>
                {row.actual_cost_per_graft_cents != null
                  ? formatMoneyFromCents(row.actual_cost_per_graft_cents)
                  : "—"}
              </td>
              <td className={financialOsClasses.tableCell}>
                {row.standard_graft_consumable_cents != null
                  ? formatMoneyFromCents(row.standard_graft_consumable_cents)
                  : "—"}
              </td>
              <td className={financialOsClasses.tableCell}>
                {row.variance_vs_standard_cents != null
                  ? formatMoneyFromCents(row.variance_vs_standard_cents)
                  : "—"}
              </td>
            </tr>
          ))}
        </FinancialOsTable>
      </div>
    </FinancialOsSectionCard>
  );
}
