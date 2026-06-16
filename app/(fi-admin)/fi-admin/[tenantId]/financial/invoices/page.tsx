import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
      <p className="mt-1 text-xs text-slate-600">Latest RevenueOS invoices for this tenant (read-only).</p>
      <div className="mt-4 overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-2 py-2">Kind</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Total</th>
              <th className="px-2 py-2">Balance</th>
              <th className="px-2 py-2">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-2 font-mono text-[11px]">{r.invoice_kind}</td>
                <td className="px-2 py-2">{r.status}</td>
                <td className="px-2 py-2">{fmtMoney(r.total_cents, r.currency)}</td>
                <td className="px-2 py-2">{fmtMoney(invoiceBalanceDueCents(r), r.currency)}</td>
                <td className="px-2 py-2">
                  {r.case_id ? (
                    <Link className="text-sky-800 underline" href={`/fi-admin/${tid}/cases/${encodeURIComponent(r.case_id)}`}>
                      Case
                    </Link>
                  ) : null}{" "}
                  {r.consultation_id ? (
                    <Link className="text-sky-800 underline" href={`/fi-admin/${tid}/consultations/${encodeURIComponent(r.consultation_id)}`}>
                      Consult
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
