import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialInternationalTransferTable } from "@/src/components/fi/financial/FinancialInternationalTransferTable";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadInternationalTransferApplications } from "@/src/lib/financialOs/financialInternationalTransfer.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · International Transfers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsInternationalTransfersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [applications, pathways, { canMutate }] = await Promise.all([
    loadInternationalTransferApplications(tid),
    loadPaymentPathwaysForTenant(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="International"
        title="International transfer applications"
        description={
          <>
            Manage cross-border bank transfer workflows for overseas patients linked to{" "}
            <code className={financialOsClasses.code}>international_transfer</code> payment pathways
            — instructions, proof of payment, reconciliation, FX variance review, and settlement
            tracking without live Wise/bank/SWIFT APIs.
          </>
        }
      />
      <FinancialInternationalTransferTable
        tenantId={tid}
        rows={applications}
        pathways={pathways}
        canMutate={canMutate}
      />
    </div>
  );
}
