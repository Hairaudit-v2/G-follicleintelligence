import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsDirectoryClient } from "@/src/components/fi/workforce/WorkforceOsDirectoryClient";
import { loadWorkforceOsDirectoryPage } from "@/src/lib/workforce-os/workforceOsDirectoryLoader.server";

export const metadata = {
  title: "Workforce directory · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsDirectoryPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const data = await loadWorkforceOsDirectoryPage(tenantId.trim());
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <WorkforceOsDirectoryClient
        tenantId={tenantId.trim()}
        rows={data.rows}
        canManage={data.canManage}
      />
    </div>
  );
}