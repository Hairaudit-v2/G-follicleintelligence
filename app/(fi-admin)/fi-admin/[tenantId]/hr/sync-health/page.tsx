import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { HrSyncHealthClient } from "@/src/components/fi-admin/hr/HrSyncHealthClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { loadHrSyncHealthPageModel } from "@/src/lib/hr/hrStaffSyncHealthPage.server";

export const metadata = {
  title: "HR sync health",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HrSyncHealthPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  try {
    const model = await loadHrSyncHealthPageModel(tid);
    return <HrSyncHealthClient tenantId={tid} pageModel={model} />;
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 401 || e.status === 403)) {
      notFound();
    }
    throw e;
  }
}
