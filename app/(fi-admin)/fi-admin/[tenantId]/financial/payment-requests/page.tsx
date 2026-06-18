import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsPaymentRequests } from "@/src/lib/financialOs/financialListLoaders.server";

export const metadata: Metadata = {
  title: "FinancialOS · Payment requests",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function FinancialOsPaymentRequestsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const rows = await loadFinancialOsPaymentRequests(tid);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Deposits"
        title="Payment requests"
        description="Checkout links and manual collection rows."
      />
      <FinancialOsTable
        isEmpty={rows.length === 0}
        emptyMessage="No payment requests found."
        head={
          <>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Amount</FinancialOsTh>
            <FinancialOsTh>Public pay</FinancialOsTh>
            <FinancialOsTh>Invoice</FinancialOsTh>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={r.status} />
            </td>
            <td className={financialOsClasses.tableCell}>{fmtMoney(r.total_cents, r.currency)}</td>
            <td className={financialOsClasses.tableCell}>
              {r.public_token ? (
                <Link
                  className={financialOsClasses.inlineLink}
                  href={`/pay/${encodeURIComponent(r.public_token)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td className={financialOsClasses.tableCellMono}>{r.invoice_id.slice(0, 8)}…</td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
