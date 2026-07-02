import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffAccessCentreClient } from "@/src/components/fi/workforce/StaffAccessCentreClient";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { loadStaffAccessCentrePage } from "@/src/lib/workforce/staffAccessCentre.server";

export const metadata = {
  title: "Staff Access Centre · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsStaffAccessPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) notFound();

  const data = await loadStaffAccessCentrePage(tenantId.trim());
  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <StaffAccessCentreClient
        tenantId={tenantId.trim()}
        rows={data.rows}
        canManage={canManage}
      />
    </div>
  );
}
