import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialPaymentPathwayForm } from "@/src/components/fi/financial/FinancialPaymentPathwayForm";
import { FinancialPaymentPathwayTimeline } from "@/src/components/fi/financial/FinancialPaymentPathwayTimeline";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Payment Pathways",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsPaymentPathwaysPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [pathways, { canMutate }] = await Promise.all([
    loadPaymentPathwaysForTenant(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Settlement"
        title="Payment pathways"
        description={
          <>
            Records how a patient intends to pay after quote/invoice acceptance (
            <code className={financialOsClasses.code}>fi_payment_pathways</code>). This is
            staff-recorded settlement intent — it does not drive Stripe checkout, ConsultationOS,
            Clinical Intelligence, or SurgeryOS behaviour.
          </>
        }
      />
      <FinancialPaymentPathwayForm tenantId={tid} canMutate={canMutate} />
      <FinancialPaymentPathwayTimeline tenantId={tid} rows={pathways} canMutate={canMutate} />
    </div>
  );
}
