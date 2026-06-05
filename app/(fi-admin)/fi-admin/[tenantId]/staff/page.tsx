import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StaffDirectoryClient } from "@/src/components/fi/staff/StaffDirectoryClient";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadStaffDirectoryPage } from "@/src/lib/staff/staffDirectoryLoader.server";

export const metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffDirectoryRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const [data, showCrmNav] = await Promise.all([
    loadStaffDirectoryPage(tenantId.trim()),
    getCrmShellNavAllowed(tenantId),
  ]);

  return <StaffDirectoryClient tenantId={tenantId.trim()} data={data} showCrmNav={showCrmNav} />;
}
