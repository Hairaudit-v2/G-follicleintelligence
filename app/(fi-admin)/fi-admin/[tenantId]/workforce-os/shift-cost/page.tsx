import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsShiftCostClient } from "@/src/components/fi/workforce/WorkforceOsShiftCostClient";
import { loadWorkforceOsShiftCostPage } from "@/src/lib/workforce/shiftCostIntelligencePage.server";

export const metadata = {
  title: "Shift cost intelligence · Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsShiftCostPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const { date } = await searchParams;
  if (!tenantId?.trim()) notFound();

  const data = await loadWorkforceOsShiftCostPage(tenantId.trim(), date);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <WorkforceOsShiftCostClient
        tenantId={tenantId.trim()}
        intelligence={data.intelligence}
        canManage={data.canManage}
      />
    </div>
  );
}