import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExpenseSpendSummary } from "@/src/lib/financialOs/expenses/expenseSpendSummaryCore";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function ExpenseSpendByCategoryPanel(props: { summary: ExpenseSpendSummary }) {
  const s = props.summary;

  return (
    <FinancialOsSectionCard
      kicker="Intelligence"
      title="Spend by category"
      description={
        <>
          Posted expenses {s.period_start} → {s.period_end}. Simple opex breakdown (not full P&amp;L).
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Total posted spend"
          value={formatMoneyFromCents(s.total_posted_spend_cents)}
        />
        <FinancialOsMetricTile label="Expense rows" value={String(s.expense_count)} />
        <FinancialOsMetricTile
          label="Categories"
          value={String(s.by_category.length)}
        />
      </dl>

      <div className="mt-4">
        <FinancialOsTable
          isEmpty={s.by_category.length === 0}
          emptyMessage="No posted expenses in this period."
          head={
            <>
              <FinancialOsTh>Category</FinancialOsTh>
              <FinancialOsTh>Count</FinancialOsTh>
              <FinancialOsTh>Spend</FinancialOsTh>
              <FinancialOsTh>% of total</FinancialOsTh>
            </>
          }
        >
          {s.by_category.map((row) => (
            <tr key={row.category_code} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>
                {row.category_label}
                <div className={financialOsClasses.mutedMeta}>{row.category_code}</div>
              </td>
              <td className={financialOsClasses.tableCell}>{row.expense_count}</td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(row.spend_cents)}
              </td>
              <td className={financialOsClasses.tableCell}>{row.pct_of_total}%</td>
            </tr>
          ))}
        </FinancialOsTable>
      </div>
    </FinancialOsSectionCard>
  );
}
