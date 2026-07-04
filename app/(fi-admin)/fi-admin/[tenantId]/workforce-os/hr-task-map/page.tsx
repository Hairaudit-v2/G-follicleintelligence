import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffHrTaskMapClient } from "@/src/components/fi/workforce/StaffHrTaskMapClient";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";

export const metadata = {
  title: "HR Task Map · Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffHrTaskMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ staffId?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const { staffId } = await searchParams;
  if (!tenantId?.trim()) notFound();

  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) notFound();
  if (!access.platformAdminPreview) {
    const role = access.userRole.trim().toLowerCase();
    if (!HR_OS_ROUTE_REQUIRED_ROLES.some((allowed) => allowed === role)) {
      notFound();
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <StaffHrTaskMapClient tenantId={tenantId.trim()} staffId={staffId?.trim() ?? null} />
    </div>
  );
}
