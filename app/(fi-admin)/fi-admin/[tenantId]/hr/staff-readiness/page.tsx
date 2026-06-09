import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { HrStaffReadinessClient } from "@/src/components/fi-admin/hr/HrStaffReadinessClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { loadHrStaffReadinessPageModel } from "@/src/lib/hr/hrStaffReadinessPage.server";

export const metadata = {
  title: "Staff readiness",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HrStaffReadinessPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  try {
    const model = await loadHrStaffReadinessPageModel(tid);
    return <HrStaffReadinessClient tenantId={tid} pageModel={model} />;
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 401 || e.status === 403)) {
      notFound();
    }
    throw e;
  }
}
