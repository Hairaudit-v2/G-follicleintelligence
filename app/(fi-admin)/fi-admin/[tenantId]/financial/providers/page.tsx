import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialProviderForm } from "@/src/components/fi/financial/FinancialProviderForm";
import { FinancialProviderTable } from "@/src/components/fi/financial/FinancialProviderTable";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinanceProviders } from "@/src/lib/financialOs/financialFinanceProviders.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · Financing Providers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsProvidersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [providers, { canMutate }] = await Promise.all([
    loadFinanceProviders(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Finance"
        title="Financing providers"
        description={
          <>
            Manage external financing providers before live API integration. Global catalog entries
            are seeded inactive except{" "}
            <strong className="font-semibold text-slate-200">Custom Provider</strong>.
            Tenant-specific providers can be added below.
          </>
        }
      />
      <FinancialProviderForm tenantId={tid} canMutate={canMutate} />
      <FinancialProviderTable tenantId={tid} rows={providers} canMutate={canMutate} />
    </div>
  );
}
