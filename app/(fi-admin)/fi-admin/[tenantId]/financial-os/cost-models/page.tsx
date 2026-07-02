import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FinancialSurgeryCostModelForm,
  FinancialSurgeryCostModelHistory,
} from "@/src/components/fi-admin/financial-os/FinancialSurgeryCostModelsPanel";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  loadCostModelCreatorLabels,
  loadSurgeryCostModelHistoryGrouped,
} from "@/src/lib/financialOs/financialSurgeryCostModel.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";

export const metadata: Metadata = {
  title: "Finances · Surgery cost models",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FinancialOsCostModelsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);

  const [groups, { canMutate }] = await Promise.all([
    loadSurgeryCostModelHistoryGrouped(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  const creatorIds = groups.flatMap(
    (g) =>
      [g.active?.created_by_fi_user_id, ...g.history.map((h) => h.created_by_fi_user_id)].filter(
        Boolean
      ) as string[]
  );
  const creatorLabelMap = await loadCostModelCreatorLabels(tid, creatorIds);
  const creatorLabels = Object.fromEntries(creatorLabelMap.entries());

  return (
    <div className="p-4 sm:p-6">
      <div className={financialOsClasses.pageSection}>
        <FinancialOsSubPageHeader
          kicker="Surgery economics"
          title="Surgery cost models"
          description="Configure per-procedure cost assumptions used by the Surgery Economics Engine. Only active models are used for profitability snapshots."
        />
        <Link href={`/fi-admin/${tid}/financial-os`} className={financialOsClasses.textButton}>
          ← Back to Financial command centre
        </Link>
        <FinancialSurgeryCostModelForm tenantId={tid} canMutate={canMutate} />
        <FinancialSurgeryCostModelHistory
          tenantId={tid}
          groups={groups}
          creatorLabels={creatorLabels}
          canMutate={canMutate}
        />
      </div>
    </div>
  );
}
