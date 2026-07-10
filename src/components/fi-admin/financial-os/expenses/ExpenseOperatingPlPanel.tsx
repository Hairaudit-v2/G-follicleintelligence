import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExpensePlSummary } from "@/src/lib/financialOs/expenses/expensePlCore";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function ExpenseOperatingPlPanel(props: { summary: ExpensePlSummary }) {
  const s = props.summary;
  const netPositive = s.net_operating_cents >= 0;

  return (
    <FinancialOsSectionCard
      kicker="Intelligence"
      title="Operating snapshot (ledger)"
      description={
        <>
          Simple P&amp;L from master ledger {s.period_start} → {s.period_end}: collections (credit)
          minus net posted opex (expense_posted − void reversals). Not a full chart of accounts.
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Collected revenue"
          value={formatMoneyFromCents(s.revenue_collected_cents)}
          foot={`${s.revenue_event_count} collection event(s)`}
        />
        <FinancialOsMetricTile
          label="Opex posted"
          value={formatMoneyFromCents(s.opex_posted_cents)}
          foot={`${s.expense_event_count} expense_posted debit(s)`}
        />
        <FinancialOsMetricTile
          label="Opex void reversals"
          value={formatMoneyFromCents(s.opex_void_reversal_cents)}
        />
        <FinancialOsMetricTile
          label="Net opex"
          value={formatMoneyFromCents(s.opex_net_cents)}
        />
        <FinancialOsMetricTile
          label="Net operating"
          value={formatMoneyFromCents(s.net_operating_cents)}
          foot={netPositive ? "Collections exceed net opex" : "Net opex exceeds collections"}
        />
      </dl>
    </FinancialOsSectionCard>
  );
}
