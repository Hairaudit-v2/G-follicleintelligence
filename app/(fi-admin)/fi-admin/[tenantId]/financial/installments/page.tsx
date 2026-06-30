import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialOsInstallmentForm } from "@/src/components/fi/financial/FinancialOsInstallmentForm";
import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { FinancialOsRecordStatusBadge } from "@/src/components/fi-admin/financial-os/FinancialOsRecordStatusBadge";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadInstallmentPlansForTenant } from "@/src/lib/financialOs/financialInstallmentPlans.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Installments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function FinancialOsInstallmentsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const plans = await loadInstallmentPlansForTenant(tid);
  const { canMutate } = await getPaymentRecordMutationCapability(tid);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Plans"
        title="Installment plans"
        description={
          <>
            Schedules are stored on{" "}
            <code className={financialOsClasses.code}>fi_installment_plans</code> — staff-managed;
            no auto-debit.
          </>
        }
      />
      <FinancialOsInstallmentForm tenantId={tid} canMutate={canMutate} />
      <FinancialOsTable
        isEmpty={plans.length === 0}
        emptyMessage="No installment plans yet."
        head={
          <>
            <FinancialOsTh>Status</FinancialOsTh>
            <FinancialOsTh>Frequency</FinancialOsTh>
            <FinancialOsTh>Installment</FinancialOsTh>
            <FinancialOsTh>Remaining</FinancialOsTh>
            <FinancialOsTh>Next</FinancialOsTh>
            <FinancialOsTh>Invoice</FinancialOsTh>
          </>
        }
      >
        {plans.map((p) => (
          <tr key={p.id} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCell}>
              <FinancialOsRecordStatusBadge status={p.status} />
            </td>
            <td className={financialOsClasses.tableCell}>{p.frequency}</td>
            <td className={financialOsClasses.tableCell}>
              {fmtMoney(p.installment_amount, p.currency)}
            </td>
            <td className={financialOsClasses.tableCell}>
              {fmtMoney(p.remaining_balance, p.currency)}
            </td>
            <td className={financialOsClasses.tableCell}>{p.next_payment_date ?? "—"}</td>
            <td className={financialOsClasses.tableCellMono}>{p.invoice_id.slice(0, 8)}…</td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
