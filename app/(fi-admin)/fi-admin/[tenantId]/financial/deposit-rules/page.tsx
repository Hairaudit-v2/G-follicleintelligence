import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsDepositRules } from "@/src/lib/financialOs/financialListLoaders.server";

export const metadata: Metadata = {
  title: "FinancialOS · Deposit rules",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsDepositRulesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const rules = await loadFinancialOsDepositRules(tid);

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Deposit rules</h2>
      <p className="mt-1 text-xs text-slate-600">Active RevenueOS deposit configuration (read-only in FinancialOS Phase 1).</p>
      <div className="mt-4 overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Kind</th>
              <th className="px-2 py-2">Priority</th>
              <th className="px-2 py-2">Active</th>
              <th className="px-2 py-2">Percent bp</th>
              <th className="px-2 py-2">Fixed ¢</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rules.map((r) => (
              <tr key={String(r.id)}>
                <td className="px-2 py-2">{String(r.name ?? "")}</td>
                <td className="px-2 py-2 font-mono text-[11px]">{String(r.rule_kind ?? "")}</td>
                <td className="px-2 py-2">{String(r.priority ?? "")}</td>
                <td className="px-2 py-2">{r.is_active ? "yes" : "no"}</td>
                <td className="px-2 py-2">{r.percent_bp != null ? String(r.percent_bp) : "—"}</td>
                <td className="px-2 py-2">{r.fixed_amount_cents != null ? String(r.fixed_amount_cents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
