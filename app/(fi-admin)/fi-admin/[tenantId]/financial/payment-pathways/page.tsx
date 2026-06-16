import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialPaymentPathwayForm } from "@/src/components/fi/financial/FinancialPaymentPathwayForm";
import { FinancialPaymentPathwayTimeline } from "@/src/components/fi/financial/FinancialPaymentPathwayTimeline";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Payment Pathways",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsPaymentPathwaysPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [pathways, { canMutate }] = await Promise.all([
    loadPaymentPathwaysForTenant(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Payment pathways</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Records how a patient intends to pay after quote/invoice acceptance (
          <code className="rounded bg-slate-100 px-1">fi_payment_pathways</code>). This is staff-recorded settlement
          intent — it does not drive Stripe checkout, ConsultationOS, Clinical Intelligence, or SurgeryOS behaviour.
        </p>
      </div>
      <FinancialPaymentPathwayForm tenantId={tid} canMutate={canMutate} />
      <FinancialPaymentPathwayTimeline tenantId={tid} rows={pathways} canMutate={canMutate} />
    </div>
  );
}
