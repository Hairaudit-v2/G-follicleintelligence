import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsPlanningClient } from "@/src/components/fi/workforce/WorkforceOsPlanningClient";
import { loadWorkforceOsPlanningPage } from "@/src/lib/workforce/workforcePlanningEnginePage.server";

export const metadata = {
  title: "Workforce planning · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsPlanningPage({
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

  const data = await loadWorkforceOsPlanningPage(tenantId.trim(), date);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <WorkforceOsPlanningClient
        tenantId={tenantId.trim()}
        planning={data.planning}
        canManage={data.canManage}
      />
    </div>
  );
}