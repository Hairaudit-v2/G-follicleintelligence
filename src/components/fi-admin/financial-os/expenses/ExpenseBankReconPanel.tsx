import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
export type ExpenseBankReconPanelProps = {
  periodStart: string;
  periodEnd: string;
  lineCount: number;
  expenseCount: number;
  matchCount: number;
  unmatchedLines: number;
  unmatchedExpenses: number;
};

export function ExpenseBankReconPanel(props: ExpenseBankReconPanelProps) {
  return (
    <FinancialOsSectionCard
      kicker="Reconciliation"
      title="Bank import ↔ expense match"
      description={
        <>
          Heuristic match for {props.periodStart} → {props.periodEnd}: linked import lines, then
          amount + date (±3 days) + vendor. Scaffold only — no auto-write of matches yet.
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile label="Import lines" value={String(props.lineCount)} />
        <FinancialOsMetricTile label="Expenses in period" value={String(props.expenseCount)} />
        <FinancialOsMetricTile label="Suggested matches" value={String(props.matchCount)} />
        <FinancialOsMetricTile label="Unmatched lines" value={String(props.unmatchedLines)} />
        <FinancialOsMetricTile
          label="Unmatched expenses"
          value={String(props.unmatchedExpenses)}
        />
        <FinancialOsMetricTile
          label="Match rate"
          value={
            props.lineCount > 0
              ? `${Math.round((props.matchCount / props.lineCount) * 100)}%`
              : "—"
          }
          foot="Of import lines in period"
        />
      </dl>
    </FinancialOsSectionCard>
  );
}
