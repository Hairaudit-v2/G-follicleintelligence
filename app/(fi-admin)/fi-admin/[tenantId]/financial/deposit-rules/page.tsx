import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialOsSubPageHeader,
  FinancialOsTable,
  FinancialOsTh,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsDepositRules } from "@/src/lib/financialOs/financialListLoaders.server";

export const metadata: Metadata = {
  title: "FinancialOS · Deposit rules",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsDepositRulesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
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
        description="Procedure-scoped deposit policy — percent, due days, slot release, cancellation fee, and transfer rules."
      />
      <FinancialOsTable
        isEmpty={rules.length === 0}
        emptyMessage="No deposit rules configured."
        head={
          <>
            <FinancialOsTh>Name</FinancialOsTh>
            <FinancialOsTh>Procedure</FinancialOsTh>
            <FinancialOsTh>Kind</FinancialOsTh>
            <FinancialOsTh>Min deposit %</FinancialOsTh>
            <FinancialOsTh>Due days</FinancialOsTh>
            <FinancialOsTh>Auto release</FinancialOsTh>
            <FinancialOsTh>Cancel fee bp</FinancialOsTh>
            <FinancialOsTh>Transfer</FinancialOsTh>
            <FinancialOsTh>Active</FinancialOsTh>
          </>
        }
      >
        {rules.map((r) => (
          <tr key={String(r.id)} className={financialOsClasses.tableRow}>
            <td className={financialOsClasses.tableCellStrong}>{String(r.name ?? "")}</td>
            <td className={financialOsClasses.tableCellMono}>
              {r.procedure_type != null ? String(r.procedure_type) : "All"}
            </td>
            <td className={financialOsClasses.tableCellMono}>{String(r.rule_kind ?? "")}</td>
            <td className={financialOsClasses.tableCell}>
              {r.minimum_deposit_percentage != null
                ? `${String(r.minimum_deposit_percentage)}%`
                : r.percent_bp != null
                  ? `${Number(r.percent_bp) / 100}%`
                  : "—"}
            </td>
            <td className={financialOsClasses.tableCell}>
              {r.deposit_due_days != null ? String(r.deposit_due_days) : "—"}
            </td>
            <td className={financialOsClasses.tableCell}>{r.auto_release_slot ? "Yes" : "No"}</td>
            <td className={financialOsClasses.tableCell}>
              {r.cancellation_fee_percentage != null ? String(r.cancellation_fee_percentage) : "—"}
            </td>
            <td className={financialOsClasses.tableCell}>
              {r.allow_transfer === false ? "No" : "Yes"}
            </td>
            <td className={financialOsClasses.tableCell}>
              <span
                className={`${financialOsStatusBadgeBase} ${r.is_active ? financialOsStatusBadgeTones.success : financialOsStatusBadgeTones.neutral}`}
              >
                {r.is_active ? "Active" : "Inactive"}
              </span>
            </td>
          </tr>
        ))}
      </FinancialOsTable>
    </div>
  );
}
