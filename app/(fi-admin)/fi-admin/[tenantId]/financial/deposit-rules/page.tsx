import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { financialOsStatusBadgeBase, financialOsStatusBadgeTones } from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
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
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Deposits"
        title="Deposit rules"
        description="Active RevenueOS deposit configuration (read-only in FinancialOS Phase 1)."
      />
      <FinancialOsTable
        isEmpty={rules.length === 0}
        emptyMessage="No deposit rules configured."
        head={
          <>
            <FinancialOsTh>Name</FinancialOsTh>
            <FinancialOsTh>Kind</FinancialOsTh>
            <FinancialOsTh>Priority</FinancialOsTh>
            <FinancialOsTh>Active</FinancialOsTh>
            <FinancialOsTh>Percent bp</FinancialOsTh>
            <FinancialOsTh>Fixed ¢</FinancialOsTh>
          </>
        }
      >
        {rules.map((r) => (
          <tr key={String(r.id)} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCellStrong}>{String(r.name ?? "")}</td>
            <td className={financialOsClasses.tableCellMono}>{String(r.rule_kind ?? "")}</td>
            <td className={financialOsClasses.tableCell}>{String(r.priority ?? "")}</td>
            <td className={financialOsClasses.tableCell}>
              <span
                className={`${financialOsStatusBadgeBase} ${r.is_active ? financialOsStatusBadgeTones.success : financialOsStatusBadgeTones.neutral}`}
              >
                {r.is_active ? "Active" : "Inactive"}
              </span>
            </td>
            <td className={financialOsClasses.tableCell}>{r.percent_bp != null ? String(r.percent_bp) : "—"}</td>
            <td className={financialOsClasses.tableCell}>{r.fixed_amount_cents != null ? String(r.fixed_amount_cents) : "—"}</td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
