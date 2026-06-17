import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialInternationalTransferTable } from "@/src/components/fi/financial/FinancialInternationalTransferTable";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadInternationalTransferApplications } from "@/src/lib/financialOs/financialInternationalTransfer.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · International Transfers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsInternationalTransfersPage({ params }: { params: Promise<{ tenantId: string }> }) {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">International transfer applications</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Manage cross-border bank transfer workflows for overseas patients linked to{" "}
          <code className="rounded bg-slate-100 px-1">international_transfer</code> payment pathways — instructions, proof of
          payment, reconciliation, FX variance review, and settlement tracking without live Wise/bank/SWIFT APIs.
        </p>
      </div>
      <FinancialInternationalTransferTable tenantId={tid} rows={applications} pathways={pathways} canMutate={canMutate} />
    </div>
  );
}
