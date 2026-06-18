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
import { loadFinancialOsInvoices } from "@/src/lib/financialOs/financialListLoaders.server";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

export const metadata: Metadata = {
  title: "FinancialOS · Invoices",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function FinancialOsInvoicesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const rows = await loadFinancialOsInvoices(tid, 400);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Revenue"
        title="Invoices"
        description="Latest RevenueOS invoices for this tenant (read-only)."
      />
      <FinancialOsTable
        isEmpty={rows.length === 0}
        emptyMessage="No invoices found."
        head={
          <>
            <FinancialOsTh>Kind</FinancialOsTh>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Total</FinancialOsTh>
            <FinancialOsTh>Balance</FinancialOsTh>
            <FinancialOsTh>Links</FinancialOsTh>
          </>
        }
      >
        {rows.map((r) => (
          <tr key={r.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCellMono}>{r.invoice_kind}</td>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={r.status} />
            </td>
            <td className={financialOsClasses.tableCell}>{fmtMoney(r.total_cents, r.currency)}</td>
            <td className={financialOsClasses.tableCell}>{fmtMoney(invoiceBalanceDueCents(r), r.currency)}</td>
            <td className={financialOsClasses.tableCell}>
              {r.case_id ? (
                <Link className={financialOsClasses.inlineLink} href={`/fi-admin/${tid}/cases/${encodeURIComponent(r.case_id)}`}>
                  Case
                </Link>
              ) : null}{" "}
              {r.consultation_id ? (
                <Link
                  className={financialOsClasses.inlineLink}
                  href={`/fi-admin/${tid}/consultations/${encodeURIComponent(r.consultation_id)}`}
                >
                  Consult
                </Link>
              ) : null}
            </td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
