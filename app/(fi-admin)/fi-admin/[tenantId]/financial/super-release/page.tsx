import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialSuperReleaseTable } from "@/src/components/fi/financial/FinancialSuperReleaseTable";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadSuperReleaseApplications } from "@/src/lib/financialOs/financialSuperRelease.server";
import { loadPaymentPathwaysForTenant } from "@/src/lib/financialOs/financialPaymentPathways.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · Super Release",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsSuperReleasePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
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
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Super"
        title="Super release applications"
        description={
          <>
            Manage medically justified retirement/superannuation release applications linked to{" "}
            <code className={financialOsClasses.code}>super_release</code> payment pathways —
            eligibility review, documents, clinical letters, submission, approval, and funds release
            tracking without live provider APIs.
          </>
        }
      />
      <FinancialSuperReleaseTable
        tenantId={tid}
        rows={applications}
        pathways={pathways}
        canMutate={canMutate}
      />
    </div>
  );
}
