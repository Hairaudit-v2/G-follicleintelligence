import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialProviderForm } from "@/src/components/fi/financial/FinancialProviderForm";
import { FinancialProviderTable } from "@/src/components/fi/financial/FinancialProviderTable";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinanceProviders } from "@/src/lib/financialOs/financialFinanceProviders.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "FinancialOS · Financing Providers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsProvidersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);
  const [providers, { canMutate }] = await Promise.all([
    loadFinanceProviders(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Financing providers</h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-600">
          Manage external financing providers before live API integration. Global catalog entries are seeded inactive except{" "}
          <strong>Custom Provider</strong>. Tenant-specific providers can be added below.
        </p>
      </div>
      <FinancialProviderForm tenantId={tid} canMutate={canMutate} />
      <FinancialProviderTable tenantId={tid} rows={providers} canMutate={canMutate} />
    </div>
  );
}
