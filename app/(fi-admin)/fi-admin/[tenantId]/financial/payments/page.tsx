import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsPayments } from "@/src/lib/financialOs/financialListLoaders.server";
import { moneyPaymentRowSourceLabel } from "@/src/lib/financialOs/moneyTrustCopy";

export const metadata: Metadata = {
  title: "Finances · Payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function FinancialOsPaymentsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const rows = await loadFinancialOsPayments(tid);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Revenue"
        title="Payments"
        description="Allocated payments on invoices. Manual tracking rows are operational records — not bank/card proof. Provider confirmed rows come from the payment provider (Stripe)."
      />
      <FinancialOsTable
        isEmpty={rows.length === 0}
        emptyMessage="No payments recorded."
        head={
          <>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Source</FinancialOsTh>
            <FinancialOsTh>Total</FinancialOsTh>
            <FinancialOsTh>Invoice</FinancialOsTh>
            <FinancialOsTh>Created</FinancialOsTh>
          </>
        }
      >
        {rows.map((r) => {
          const source = moneyPaymentRowSourceLabel(r.provider);
          return (
          <tr key={r.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={r.status} />
            </td>
            <td className={financialOsClasses.tableCell}>
              <span className={source.providerConfirmed ? "text-emerald-300" : "text-amber-300"}>
                {source.label}
              </span>
            </td>
            <td className={financialOsClasses.tableCell}>{fmtMoney(r.total_cents, r.currency)}</td>
            <td className={financialOsClasses.tableCellMono}>{r.invoice_id.slice(0, 8)}…</td>
            <td className={financialOsClasses.tableCell}>{r.created_at.slice(0, 19)}</td>
          </tr>
          );
        })}
      </FinancialOsTable>
    </div>
  );
}
