import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsPayments } from "@/src/lib/financialOs/financialListLoaders.server";

export const metadata: Metadata = {
  title: "FinancialOS · Payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string): string {
  const v = cents / 100;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function FinancialOsPaymentsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const rows = await loadFinancialOsPayments(tid);

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
      <p className="mt-1 text-xs text-slate-600">Allocated payments on invoices (includes Stripe and manual).</p>
      <div className="mt-4 overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Provider</th>
              <th className="px-2 py-2">Total</th>
              <th className="px-2 py-2">Invoice</th>
              <th className="px-2 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-2">{r.status}</td>
                <td className="px-2 py-2 font-mono text-[11px]">{r.provider ?? "—"}</td>
                <td className="px-2 py-2">{fmtMoney(r.total_cents, r.currency)}</td>
                <td className="px-2 py-2 font-mono text-[10px]">{r.invoice_id.slice(0, 8)}…</td>
                <td className="px-2 py-2 text-slate-600">{r.created_at.slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
