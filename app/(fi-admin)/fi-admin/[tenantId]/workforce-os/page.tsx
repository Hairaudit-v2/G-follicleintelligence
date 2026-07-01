import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceCommandCentreClient } from "@/src/components/fi-admin/workforce/WorkforceCommandCentreClient";
import { loadWorkforceCommandCentrePage } from "@/src/lib/workforce/workforceCommandCentrePage.server";

export const metadata = {
  title: "Workforce Intelligence Centre · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsCommandCentrePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const data = await loadWorkforceCommandCentrePage(tenantId.trim());
  if (!data) notFound();

  return (
    <div className="pb-8">
      <WorkforceCommandCentreClient tenantId={tenantId.trim()} data={data} />
    </div>
  );
}