import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ClinicPlSummary } from "@/src/lib/financialOs/expenses/expenseChartOfAccountsCore";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function ExpenseMultiClinicPlPanel(props: { summary: ClinicPlSummary }) {
  const s = props.summary;
  const rows = [
    ...s.by_clinic,
    ...(s.unallocated.revenue_collected_cents > 0 || s.unallocated.opex_net_cents > 0
      ? [s.unallocated]
      : []),
  ];

  return (
    <FinancialOsSectionCard
      kicker="Chart of accounts"
      title="Multi-clinic operating P&L"
      description={
        <>
          Ledger collections vs net opex by{" "}
          <code className={financialOsClasses.code}>clinic_id</code> for {s.period_start} →{" "}
          {s.period_end}. Light COA seeds map categories → GL codes for export.
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Total collections"
          value={formatMoneyFromCents(s.totals.revenue_collected_cents)}
        />
        <FinancialOsMetricTile
          label="Total net opex"
          value={formatMoneyFromCents(s.totals.opex_net_cents)}
        />
        <FinancialOsMetricTile
          label="Net operating"
          value={formatMoneyFromCents(s.totals.net_operating_cents)}
        />
        <FinancialOsMetricTile label="Clinics with activity" value={String(s.by_clinic.length)} />
      </dl>

      <div className="mt-4">
        <FinancialOsTable
          isEmpty={rows.length === 0}
          emptyMessage="No clinic-attributed ledger activity in this period."
          head={
            <>
              <FinancialOsTh>Clinic</FinancialOsTh>
              <FinancialOsTh>Collections</FinancialOsTh>
              <FinancialOsTh>Net opex</FinancialOsTh>
              <FinancialOsTh>Net operating</FinancialOsTh>
            </>
          }
        >
          {rows.map((row) => (
            <tr key={row.clinic_id ?? "none"} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>{row.clinic_name}</td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(row.revenue_collected_cents)}
              </td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(row.opex_net_cents)}
              </td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(row.net_operating_cents)}
              </td>
            </tr>
          ))}
        </FinancialOsTable>
      </div>
    </FinancialOsSectionCard>
  );
}
