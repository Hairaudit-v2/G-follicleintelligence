import {
  FinancialOsMetricTile,
  FinancialOsSectionCard,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExpenseCplSummary } from "@/src/lib/financialOs/expenses/expenseCplCore";
import { formatMoneyFromCents } from "@/src/lib/format/money";

export function ExpenseCplPanel(props: { summary: ExpenseCplSummary }) {
  const s = props.summary;

  return (
    <FinancialOsSectionCard
      kicker="Intelligence"
      title="Cost per lead (CPL)"
      description={
        <>
          Posted marketing spend ({s.period_start} → {s.period_end}) ÷ leads created in the same
          window. Categories starting with{" "}
          <code className={financialOsClasses.code}>marketing_</code> or any expense with a campaign
          key count as spend. Use the period filter above to change the window.
        </>
      }
    >
      <dl className={financialOsClasses.metricGrid}>
        <FinancialOsMetricTile
          label="Marketing spend"
          value={formatMoneyFromCents(s.total_marketing_spend_cents)}
        />
        <FinancialOsMetricTile label="Leads" value={String(s.total_leads)} />
        <FinancialOsMetricTile
          label="Overall CPL"
          value={
            s.overall_cpl_cents != null ? formatMoneyFromCents(s.overall_cpl_cents) : "—"
          }
          foot={
            s.overall_cpl_cents == null
              ? "Needs posted marketing spend and at least one lead."
              : undefined
          }
        />
        <FinancialOsMetricTile
          label="Unattributed spend"
          value={formatMoneyFromCents(s.unattributed_spend_cents)}
          foot="Marketing spend without campaign key"
        />
      </dl>

      <div className="mt-4">
        <FinancialOsTable
          isEmpty={s.by_campaign.length === 0}
          emptyMessage="No campaign-level spend or leads in this period."
          head={
            <>
              <FinancialOsTh>Campaign</FinancialOsTh>
              <FinancialOsTh>Spend</FinancialOsTh>
              <FinancialOsTh>Leads</FinancialOsTh>
              <FinancialOsTh>CPL</FinancialOsTh>
            </>
          }
        >
          {s.by_campaign.map((row) => (
            <tr key={row.campaign_key} className={financialOsClasses.tableRow}>
              <td className={financialOsClasses.tableCellStrong}>{row.campaign_key}</td>
              <td className={financialOsClasses.tableCell}>
                {formatMoneyFromCents(row.spend_cents)}
              </td>
              <td className={financialOsClasses.tableCell}>{row.lead_count}</td>
              <td className={financialOsClasses.tableCell}>
                {row.cpl_cents != null ? formatMoneyFromCents(row.cpl_cents) : "—"}
              </td>
            </tr>
          ))}
        </FinancialOsTable>
      </div>
    </FinancialOsSectionCard>
  );
}
