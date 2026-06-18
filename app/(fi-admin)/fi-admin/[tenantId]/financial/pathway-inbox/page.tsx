import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialPaymentPathwayInboxTable } from "@/src/components/fi/financial/FinancialPaymentPathwayInboxTable";
import { FinancialOsSubPageHeader, financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import { loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadPaymentPathwayInbox } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Pathway inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsPathwayInboxPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);

  const [rows, users, { canMutate }] = await Promise.all([
    loadPaymentPathwayInbox(tid),
    loadCrmShellUserPickerOptions(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Operations"
        title="Payment pathway operations inbox"
        description={
          <>
            Staff workflow queue for non-standard payment pathways (
            <code className={financialOsClasses.code}>fi_payment_pathway_tasks</code>). Tasks are auto-created when patients or staff select medical
            finance, super release, international transfer, installment plan, or manual pathways — not for pay-in-full or deposit/balance.
          </>
        }
      />
      <FinancialPaymentPathwayInboxTable tenantId={tid} rows={rows} users={users} canMutate={canMutate} />
    </div>
  );
}
