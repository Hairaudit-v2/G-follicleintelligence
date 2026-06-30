import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PayrollStaffImportClient } from "@/src/components/fi-admin/hr/PayrollStaffImportClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { loadHrStaffImportPageModel } from "@/src/lib/staff/staffHrImportPage.server";

export const metadata = {
  title: "Payroll staff import",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PayrollStaffImportPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  try {
    const model = await loadHrStaffImportPageModel(tid);
    return <PayrollStaffImportClient tenantId={tid} pageModel={model} />;
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 401 || e.status === 403)) {
      notFound();
    }
    throw e;
  }
}
