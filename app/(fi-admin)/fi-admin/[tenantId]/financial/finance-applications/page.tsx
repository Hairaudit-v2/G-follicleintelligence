import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialFinanceApplicationTable } from "@/src/components/fi/financial/FinancialFinanceApplicationTable";
import { FinancialOsSubPageHeader, financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinanceApplications } from "@/src/lib/financialOs/financialFinanceApplications.server";
import { loadFinanceProviders } from "@/src/lib/financialOs/financialFinanceProviders.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Finance Applications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsFinanceApplicationsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [applications, providers, pathways, { canMutate }] = await Promise.all([
    loadFinanceApplications(tid),
    loadFinanceProviders(tid),
    loadPaymentPathwaysForTenant(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Finance"
        title="Finance applications"
        description={
          <>
            Track financing applications linked to <code className={financialOsClasses.code}>medical_finance</code> payment pathways — document collection,
            approval workflow, and settlement tracking without live provider APIs.
          </>
        }
      />
      <FinancialFinanceApplicationTable
        tenantId={tid}
        rows={applications}
        providers={providers}
        pathways={pathways}
        canMutate={canMutate}
      />
    </div>
  );
}
