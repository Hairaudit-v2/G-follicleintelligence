import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsStaffProfileClient } from "@/src/components/fi/workforce/WorkforceOsStaffProfileClient";
import { loadWorkforceOsStaffProfilePage } from "@/src/lib/workforce-os/workforceOsDirectoryLoader.server";

export const metadata = {
  title: "Staff Profile · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsStaffProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; staffId: string }>;
}) {
  noStore();
  const { tenantId, staffId } = await params;
  if (!tenantId?.trim() || !staffId?.trim()) notFound();

  const data = await loadWorkforceOsStaffProfilePage(tenantId.trim(), staffId.trim());
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <WorkforceOsStaffProfileClient
        tenantId={tenantId.trim()}
        lifecycle={data.lifecycle}
        audit={data.audit}
        canManage={data.canManage}
        iiohrCandidates={data.iiohrCandidates}
      />
    </div>
  );
}
