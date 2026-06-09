import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StaffLinkUsersClient } from "@/src/components/fi/staff/StaffLinkUsersClient";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadStaffFiUserLinkPage } from "@/src/lib/staff/staffFiUserLink.server";

export const metadata = {
  title: "Link staff to users",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLinkUsersRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const [pageModel, showCrmNav] = await Promise.all([
    loadStaffFiUserLinkPage(tenantId.trim()),
    getCrmShellNavAllowed(tenantId),
  ]);

  if (!showCrmNav) notFound();

  return <StaffLinkUsersClient tenantId={tenantId.trim()} pageModel={pageModel} />;
}
