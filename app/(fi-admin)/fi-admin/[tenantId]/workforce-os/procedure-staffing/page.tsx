import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsProcedureStaffingClient } from "@/src/components/fi/workforce/WorkforceOsProcedureStaffingClient";
import { loadWorkforceOsProcedureStaffingPage } from "@/src/lib/workforce/procedureStaffingOptimizerPage.server";

export const metadata = {
  title: "Procedure staffing optimizer · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsProcedureStaffingPage({
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

  const data = await loadWorkforceOsProcedureStaffingPage(tenantId.trim(), date);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <WorkforceOsProcedureStaffingClient
        tenantId={tenantId.trim()}
        optimizer={data.optimizer}
        workDate={data.workDate}
        canManage={data.canManage}
      />
    </div>
  );
}