import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialSuperReleaseTable } from "@/src/components/fi/financial/FinancialSuperReleaseTable";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadSuperReleaseApplications } from "@/src/lib/financialOs/financialSuperRelease.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Super Release",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsSuperReleasePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [applications, pathways, { canMutate }] = await Promise.all([
    loadSuperReleaseApplications(tid),
    loadPaymentPathwaysForTenant(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Super release applications</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Manage medically justified retirement/superannuation release applications linked to{" "}
          <code className="rounded bg-slate-100 px-1">super_release</code> payment pathways — eligibility review, documents,
          clinical letters, submission, approval, and funds release tracking without live provider APIs.
        </p>
      </div>
      <FinancialSuperReleaseTable tenantId={tid} rows={applications} pathways={pathways} canMutate={canMutate} />
    </div>
  );
}
