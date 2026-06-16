import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialOsInstallmentForm } from "@/src/components/fi/financial/FinancialOsInstallmentForm";
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

export default async function FinancialOsInstallmentsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const plans = await loadInstallmentPlansForTenant(tid);
  const { canMutate } = await getPaymentRecordMutationCapability(tid);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Installment plans</h2>
        <p className="mt-1 text-xs text-slate-600">Schedules are stored on <code className="rounded bg-slate-100 px-1">fi_installment_plans</code> — staff-managed; no auto-debit.</p>
      </div>
      <FinancialOsInstallmentForm tenantId={tid} canMutate={canMutate} />
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Frequency</th>
              <th className="px-2 py-2">Installment</th>
              <th className="px-2 py-2">Remaining</th>
              <th className="px-2 py-2">Next</th>
              <th className="px-2 py-2">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-2 py-2">{p.status}</td>
                <td className="px-2 py-2">{p.frequency}</td>
                <td className="px-2 py-2">{fmtMoney(p.installment_amount, p.currency)}</td>
                <td className="px-2 py-2">{fmtMoney(p.remaining_balance, p.currency)}</td>
                <td className="px-2 py-2">{p.next_payment_date ?? "—"}</td>
                <td className="px-2 py-2 font-mono text-[10px]">{p.invoice_id.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
