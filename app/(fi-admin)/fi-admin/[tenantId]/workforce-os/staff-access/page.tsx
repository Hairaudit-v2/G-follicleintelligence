import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffAccessCentreClient } from "@/src/components/fi/workforce/StaffAccessCentreClient";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { loadStaffAccessCentrePage } from "@/src/lib/workforce/staffAccessCentre.server";
import { resolveWorkforceHrManageCapability } from "@/src/lib/workforce/workforceHrManageGate.server";

export const metadata = {
  title: "Staff access · Team",
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

  const [data, manage] = await Promise.all([
    loadStaffAccessCentrePage(tenantId.trim()),
    resolveWorkforceHrManageCapability(tenantId.trim()),
  ]);

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <StaffAccessCentreClient
        tenantId={tenantId.trim()}
        rows={data.rows}
        canManage={manage.canManage}
      />
    </div>
  );
}
